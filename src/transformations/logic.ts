import traverse, { Visitor } from '@babel/traverse';
import {
  blockStatement,
  expressionStatement,
  File,
  Identifier,
  ifStatement,
  isBinaryExpression,
  isCallExpression,
  isFunctionDeclaration,
  isFunctionExpression,
  isIdentifier,
  isLogicalExpression,
  isMemberExpression,
  isSequenceExpression,
} from '@babel/types';
import * as t from '@babel/types';
import generate from '@babel/generator';

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
          //if (!isFunctionExpression(callee) && !isIdentifier(callee)) return;

          if (isFunctionExpression(callee)) {
            const { id, params, body } = callee;
            if (id !== null) return;
            path.replaceWith(ifStatement(left, body));
          } else {
            path.replaceWith(ifStatement(left, blockStatement([expressionStatement(right)])));
          }

          return;

        case 'ParenthesizedExpression':
          path.replaceWith(ifStatement(left, blockStatement([expressionStatement(right.expression)])));
          return;
        case 'ConditionalExpression':
          path.replaceWith(ifStatement(left, blockStatement([expressionStatement(right)])));
          return;

        // case 'SequenceExpression':
        //   path.replaceWith(ifStatement(left, blockStatement(right.expressions.map((e) => expressionStatement(e)))));
        //   return;
      }
    },
  };
};
