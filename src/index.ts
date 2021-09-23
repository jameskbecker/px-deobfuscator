import generator from '@babel/generator';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import { File } from '@babel/types';
import fs from 'fs-extra';
import path from 'path';
import prettier, { Options } from 'prettier';
import { getChartValue, visitStringDecodeCalls } from './transformations/decode';
import {
  cleanMemberExpressions,
  expandSequenceExpressions,
  postGeneral,
} from './transformations/general';
import {
  labelAtobGetter,
  labelAtobPolyfill,
  labelAtobWrapper,
  labelChartDecode,
  labelDecodeBWrapper,
  labelGetters,
  labelPerformanceNow,
  labelResponseHandlers,
  labelStandardDecode,
} from './transformations/labels';
import { logicalExpressionToIfStatement } from './transformations/logic';
import loops from './transformations/loops';
import { bigIntToHex, booleanExpressions } from './transformations/node-format';
import {
  removeRedefinitions,
  removeRedudantStringVars,
  removeRedudantVoidVar,
} from './transformations/removals';

const inputFileName = process.argv[2];
const outputFileName = process.argv[3] || inputFileName;

let chart = '';

const readInput = async () => {
  const inputPath = path.resolve('input', inputFileName);
  const data = await fs.readFile(inputPath);
  return data.toString();
};

const generateOutput = (ast: File) => {
  const { code } = generator(ast);
  const options: Options = {
    semi: true,
    singleQuote: true,
    bracketSpacing: true,
    tabWidth: 2,
    parser: 'babel',
    printWidth: 11000,
  };
  return prettier.format(code, options);
};

const writeOutput = async (data: string) => {
  const outputPath = path.resolve('output', outputFileName);
  await fs.writeFile(outputPath, data);
};

const logic = (ast: File) => {
  console.log('Transforming logic');
  traverse(ast, {
    ...logicalExpressionToIfStatement(),
  });
  return ast;
};

const preGeneral = (ast: File) => {
  ast = labelStandardDecode(ast);
  ast = removeRedefinitions(ast, 'standardDecode');
  ast = loops(ast);

  ast = expandSequenceExpressions(ast);
  ast = removeRedudantStringVars(ast);
  ast = removeRedudantVoidVar(ast);

  ast = labelChartDecode(ast);

  ast = removeRedefinitions(ast, 'chartDecode');

  ast = labelAtobPolyfill(ast);

  ast = expandSequenceExpressions(ast);
  ast = logic(ast);
  ast = expandSequenceExpressions(ast);

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

const decode = (ast: File) => {
  chart = getChartValue(ast);

  console.log('Decoding encoded strings');
  traverse(ast, visitStringDecodeCalls(chart));
  return ast;
};

(async () => {
  const data = await readInput();
  let ast: any = parse(data.toString());
  console.log('Reformatting Nodes');
  traverse(ast, {
    ...booleanExpressions(),
    ...bigIntToHex(),
  });

  ast = preGeneral(ast);
  ast = decode(ast);

  ast = postGeneral(ast);
  ast = removeRedudantVoidVar(ast);
  ast = removeRedudantStringVars(ast);
  ast = cleanMemberExpressions(ast);
  const outputData = generateOutput(ast);
  await writeOutput(outputData);
})();
