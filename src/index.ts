import { transformAsync } from '@babel/core';
import generate from '@babel/generator';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import { createHash } from 'crypto';
import fs from 'fs-extra';
import path from 'path';
import { Options } from 'prettier';
import config from './config';
const recast = require('recast');
import { getChartValue, visitStringDecodeCalls, visitStringDecodeCalls2 } from './transformations/decode';
import { cleanMemberExpressions, switchBinaryExpressions } from './transformations/general';
import {
  labelAtobGetter,
  labelAtobPolyfill,
  labelAtobWrapper,
  labelChartDecode,
  labelDecodeBWrapper,
  labelGetters,
  labelPerformanceNow,
  labelResponseHandlerParams,
  labelResponseHandlers,
  labelStandardDecode,
} from './transformations/labels';
import { logicalExpressionToIfStatement } from './transformations/logic';
import loops from './transformations/loops';
import { addIfStatementBody, addLoopBody, bigIntToHex, booleanExpressions } from './transformations/node-format';
import { removeRedefinitions, removeRedudantStringVars, removeRedudantVoidVar } from './transformations/removals';
import { rescope } from './transformations/rescope';
import { expandSequenceExpressions, expandVarDecs } from './transformations/sequenceExpressions';

const inputFileName = process.argv[2];

let chart = '';
let hash = '';

const readInput = async () => {
  const inputPath = path.resolve('input', inputFileName);
  const data = await fs.readFile(inputPath);
  hash = hashData(data);
  return data.toString();
};

const generateOutput = async (ast: t.File) => {
  const { code } = generate(ast, { retainFunctionParens: true });
  const options: Options = {
    semi: true,
    //singleQuote: true,
    bracketSpacing: true,
    tabWidth: 2,
    parser: 'babel',
    printWidth: 125,
  };
  return code;
};

const writeOutput = async (data: string) => {
  const outputFileName = process.argv[3] || `${inputFileName.replace('.js', '')}.${hash}.js`;
  const outputPath = path.resolve('output', outputFileName);
  await fs.writeFile(outputPath, data);
};

const logic = (ast: t.File) => {
  console.log('Transforming logic');
  traverse(ast, logicalExpressionToIfStatement());
  return ast;
};

const hashData = (input: Buffer) => {
  return createHash('md5').update(input).digest('hex');
};

const preGeneral = (ast: t.File) => {
  console.log('Reformatting Nodes');
  traverse(ast, {
    ...booleanExpressions(),
    ...bigIntToHex(),
    ...addLoopBody(),
    ...addIfStatementBody(),
  });

  ast = loops(ast);
  ast = labelAtobPolyfill(ast);

  console.log('Labelling Atob Getter');
  traverse(ast, labelAtobGetter());

  console.log('Labelling Atob Wrapper');
  traverse(ast, labelAtobWrapper());
  console.log('Labelling Decode-B Wrapper');
  traverse(ast, labelDecodeBWrapper());

  console.log('Labelling PerformanceNow, Response Handlers, Getters');
  traverse(ast, {
    ...labelPerformanceNow(),
    ...labelResponseHandlers(),
    ...labelGetters(),
  });
  return ast;
};

const decode = (ast: t.File) => {
  //chart = getChartValue(ast);

  console.log('Decoding encoded strings');
  traverse(ast, visitStringDecodeCalls(chart));
  return ast;
};

const postGeneral = (ast: t.File) => {
  console.log('Cleaning things up...');
  traverse(ast, {
    //...cleanVarInitSequence(),
    //...labelCatchParam(),
    ...switchBinaryExpressions(),
  });

  return ast;
};

(async () => {
  const data = await readInput();
  let ast: any = parse(data.toString(), {
    createParenthesizedExpressions: true,
  });

  ast = preGeneral(ast);
  ast = decode(ast);
  ast = postGeneral(ast);
  ast = expandSequenceExpressions(ast);
  ast = removeRedudantStringVars(ast); //helps find decode functions

  ast = labelStandardDecode(ast);
  ast = labelChartDecode(ast);
  traverse(ast, {
    ParenthesizedExpression(path) {
      const { node } = path;
      const { expression } = node;
      if (t.isIdentifier(expression) || t.isLiteral(expression)) {
        path.replaceWith({ ...expression });
      }
    },
  });

  ast = removeRedefinitions(ast, config.standard);
  ast = removeRedefinitions(ast, config.chart);
  chart = getChartValue(ast);
  if (!chart) throw new Error('chart aint found');
  console.log('Decoding encoded strings');
  traverse(ast, visitStringDecodeCalls2(chart));
  ast = expandSequenceExpressions(ast);
  ast = removeRedudantStringVars(ast);
  ast = removeRedudantVoidVar(ast);
  ast = cleanMemberExpressions(ast);
  ast = labelResponseHandlerParams(ast);
  ast = logic(ast);

  //experimental
  //ast = rescope(ast)
  traverse(ast, {
    StringLiteral(path) {
      const { node, parentPath, parent } = path;
      if (t.isBlockStatement(parent) && t.isFunction(parentPath.parent)) {
        path.remove();
      }
    },

    VariableDeclaration(path) {
      const { node } = path;
      if (!node.declarations[0]) return;

      const { id, init } = node.declarations[0];
      if (!t.isIdentifier(id) || !t.isObjectExpression(init)) return;
      const {code} = generate(node);
      if (id.name === 'rs') debugger
      const { properties } = init;
      if (properties.length > 0) return;

      const nextSiblings = path.getAllNextSiblings();
   
      const test = (s: t.Node) => {
        //if (!t.isExpressionStatement(s)) return false;
        //const {expression} = s;

        if (!t.isAssignmentExpression(s)) return false;
        const {operator, left, right} = s;

        if (operator !== '=' || !t.isMemberExpression(left) || (!t.isLiteral(right) && !t.isIdentifier(right) && !t.isMemberExpression(right) && !t.isCallExpression(right))) return false;
        const {object, property} = left;

        if (!t.isIdentifier(object) || object.name !== id.name || !t.isIdentifier(property)) return false;

        return true;
      }
      let newNode = {...node}
      let rep = false;
      for (let i = 0; i < nextSiblings.length; i++) {
        const sibling = nextSiblings[i].node;
        if (!test(sibling)) break;
        let s = <t.AssignmentExpression>sibling;
        //@ts-ignore
        (<t.ObjectExpression>newNode.declarations[0].init).properties.push(t.objectProperty(s.left.property, s.right))
        rep = true;
        nextSiblings[i].remove();
      }
      if (!rep) return;
      path.replaceWith(newNode)
      
    }
  });
  const outputData = await generateOutput(ast);
  await writeOutput(outputData);
})();
