import traverse, { Visitor } from '@babel/traverse';
import {
  blockStatement,
  expressionStatement,
  File,
  Identifier,
  ifStatement,
  isCallExpression,
  isFunctionExpression,
  isIdentifier,
  isLogicalExpression,
  isSequenceExpression,
} from '@babel/types';

export const logicalExpressionToIfStatement = (): Visitor => {
  return {
    ExpressionStatement(path) {
      const { node } = path;
      const { expression } = node;
      if (!isLogicalExpression(expression)) return;

      const { operator, left, right } = expression;
      if (operator !== '&&') return;
      switch (right.type) {
        case 'CallExpression':
          const { callee } = right;
          const args = right.arguments;
          if ((!isFunctionExpression(callee) && !isIdentifier(callee)) || args.length !== 0) return;

          if (isFunctionExpression(callee)) {
            const { id, params, body } = callee;
            if (id !== null || params.length !== 0) return;
            path.replaceWith(ifStatement(left, body));
          } else {
            path.replaceWith(ifStatement(left, expressionStatement(right)));
          }

          return;

        case 'SequenceExpression':
          path.replaceWith(ifStatement(left, blockStatement([expressionStatement(right)])));
          return;
      }
    },
  };
};
