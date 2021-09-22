import traverse, { Visitor } from '@babel/traverse';
import {
  File,
  forStatement,
  isSequenceExpression,
  isUnaryExpression,
  isVariableDeclaration,
  UnaryExpression,
  variableDeclaration,
} from '@babel/types';
import { isVoid0 } from './types';

/** @description checks if a loop has more than 1 init var declarations and moves them outside and before the loop
 * @re
 */
const replaceForLoopSequence = (): Visitor => {
  return {
    ForStatement(path) {
      const { node } = path;
      if (isVariableDeclaration(node.init) && node.init.declarations.length > 1) {
        const { declarations } = node.init;
        let prevDeclarations = declarations.slice(0, declarations.length - 1);
        let newForInit = variableDeclaration('var', [declarations[declarations.length - 1]]);
        let newVarDeclarations = prevDeclarations.map((d) => variableDeclaration('var', [d]));
        let newForStatement = forStatement(newForInit, node.test, node.update, node.body);
        path.replaceWithMultiple([...newVarDeclarations, newForStatement]);
      }
    },
  };
};

/** @todo Consider intergrating with replaceForLoopSequence */
const removeForLoopVoid = (): Visitor => {
  return {
    ForStatement(path) {
      const { node } = path;
      if (
        isSequenceExpression(node.init) &&
        node.init.expressions.length > 0 &&
        isUnaryExpression(node.init.expressions[node.init.expressions.length - 1]) &&
        isVoid0(<UnaryExpression>node.init.expressions[node.init.expressions.length - 1])
      ) {
        node.init.expressions.pop();
        path.replaceWith(forStatement(node.init, node.test, node.update, node.body));
      }
    },
  };
};

const loops = (ast: File) => {
  console.log('Removing For Loop Void0');
  traverse(ast, removeForLoopVoid());
  console.log('Expanding For Loop Init Sequence');
  traverse(ast, replaceForLoopSequence());
  return ast;
};

export default loops;
