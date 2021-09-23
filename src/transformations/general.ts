import traverse, { Visitor } from '@babel/traverse';
import {
  binaryExpression,
  expressionStatement,
  File,
  identifier,
  isCallExpression,
  isFunctionExpression,
  isLiteral,
  isSequenceExpression,
  isStringLiteral,
  isUpdateExpression,
  memberExpression,
  returnStatement,
  variableDeclaration,
  variableDeclarator,
  VariableDeclarator,
} from '@babel/types';

export const expandSequenceExpressions = (ast: File) => {
  console.log('Expanding Sequence Expressions (1/2)');
  traverse(ast, {
    ExpressionStatement(path) {
      let skip = false;
      const { node } = path;
      const { expression } = node;
      if (!isSequenceExpression(expression)) return;

      const { expressions } = expression;
      if (expressions.length <= 1) return;

      const newStatements = expressions.map((e) => {
        if (isUpdateExpression(e)) {
          skip = true;
        }

        if (isCallExpression(e) && isFunctionExpression(e.callee)) {
          e.callee.extra = {
            parenthesized: true,
          };
        }

        return expressionStatement(e);
      });
      if (skip) return;
      path.replaceWithMultiple(newStatements);
    },
    // LogicalExpression(path) {
    //   let skip = false;
    //   const { node } = path;
    //   const { right } = node;
    //   if (!isSequenceExpression(right)) return;

    //   const { expressions } = right;
    //   if (expressions.length <= 1) return;

    //   const newStatements = expressions.map((e) => {
    //     if (isUpdateExpression(e)) {
    //       skip = true;
    //     }
    //     return expressionStatement(e);
    //   });
    //   if (skip) return;
    //   path.replaceWithMultiple(newStatements);
    // },
  });

  console.log('Expanding Sequence Expressions (2/2)');
  traverse(ast, {
    VariableDeclaration(path) {
      const { node } = path;
      const { declarations } = node;

      if (declarations.length > 1) {
        const newDeclarations = declarations.map((d: VariableDeclarator) => {
          const x = variableDeclaration('var', [d]);
          return x;
        });
        path.replaceWithMultiple(newDeclarations);
      }

      if (declarations.length !== 1) return;
      const { init, id } = declarations[0];
      if (!isSequenceExpression(init) || init.expressions.length < 2) return;
      const { expressions } = init;

      let prevExpressions = expressions.splice(0, expressions.length - 1);
      prevExpressions = prevExpressions.filter((e) => !isStringLiteral(e));
      const definition = expressions[expressions.length - 1];
      path.replaceWithMultiple([
        ...prevExpressions.map((e) => expressionStatement(e)),
        variableDeclaration(node.kind, [variableDeclarator(id, definition)]),
      ]);
    },
    ReturnStatement(path) {
      const { node } = path;
      const { argument } = node;
      if (!isSequenceExpression(argument) || argument.expressions.length < 2) return;
      const { expressions } = argument;
      const prevExpressions = expressions.splice(0, expressions.length - 1);
      const definition = expressions[expressions.length - 1];
      path.replaceWithMultiple([
        ...prevExpressions.map((e) => expressionStatement(e)),
        returnStatement(definition),
      ]);
    },
  });

  return ast;
};

export const cleanMemberExpressions = (ast: File) => {
  console.log('Tidying Member Expresssions');
  traverse(ast, {
    MemberExpression(path) {
      const { node } = path;
      if (
        isStringLiteral(node.property) &&
        /^[a-zA-Z_$][a-zA-Z0-9_]*?$/.test(node.property.value)
      ) {
        path.replaceWith(
          memberExpression(node.object, identifier(node.property.value), false, node.optional)
        );
      }
    },
  });
  return ast;
};

/** @description */
const cleanVarInitSequence = (): Visitor => {
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

const switchBinaryExpressions = (): Visitor => {
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

export const postGeneral = (ast: File) => {
  console.log('Cleaning things up...');
  traverse(ast, {
    ...cleanVarInitSequence(),
    //...labelCatchParam(),
    ...switchBinaryExpressions(),
  });

  return ast;
};
