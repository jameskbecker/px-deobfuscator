import traverse, { Visitor } from '@babel/traverse';
import {
  binaryExpression,
  File,
  identifier,
  isLiteral,
  isSequenceExpression,
  isStringLiteral,
  memberExpression,
} from '@babel/types';

export const cleanMemberExpressions = (ast: File) => {
  console.log('Tidying Member Expresssions');
  traverse(ast, {
    MemberExpression(path) {
      const { node } = path;
      if (isStringLiteral(node.property) && /^[a-zA-Z_$][a-zA-Z0-9_]*?$/.test(node.property.value)) {
        path.replaceWith(memberExpression(node.object, identifier(node.property.value), false, node.optional));
      }
    },
  });
  return ast;
};

/** @description */
export const cleanVarInitSequence = (): Visitor => {
  return {
    VariableDeclarator(path) {
      const { node } = path;
      const { id, init } = node;

      if (!isSequenceExpression(init)) return;

      const { expressions } = init;

      let expr = expressions.filter((e, i) => !isStringLiteral(e) || i === expressions.length - 1);
      init.expressions = expr;
    },
  };
};

export const switchBinaryExpressions = (): Visitor => {
  return {
    BinaryExpression(path) {
      const { node } = path;
      const { operator, left, right } = node;

      //if some kind of literal is on (and only) the left side swich them around
      if (isLiteral(left) && !isLiteral(right) && ['==', '===', '!=', '!=='].includes(operator))
        path.replaceWith(binaryExpression(operator, right, left));
    },
  };
};
