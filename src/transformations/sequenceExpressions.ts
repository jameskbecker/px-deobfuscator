import traverse, { Visitor } from '@babel/traverse';
import * as t from '@babel/types';
import { isFunctionA, isFunctionB } from './types';

export const expandVarDecs = (): Visitor => {
  return {
    VariableDeclaration(path) {
      const { node } = path;
      const { declarations } = node;
      if (declarations.length > 1) {
        const newDeclarations = declarations.map((d: t.VariableDeclarator) => {
          const x = t.variableDeclaration('var', [d]);
          return x;
        });
        path.replaceWithMultiple(newDeclarations);
      }
    },
  };
};

export const expandSequenceExpressions = (ast: t.File) => {
  console.log('Expanding Sequence Expressions (1/2)');

  let counter = 0;
  let instances: string[] = [];
  traverse(ast, {
    SequenceExpression(path) {
      const { node } = path;
      const sParent = path.getStatementParent();
      if (!sParent) return;

      const { expressions } = node;
      const expCopy = [...expressions];

      let prevExpressions = expCopy.splice(0, expressions.length - 1);

      prevExpressions = prevExpressions.filter((e) => {
        return !t.isStringLiteral(e) && !(t.isParenthesizedExpression(e) && t.isStringLiteral(e.expression));
      });
      prevExpressions = prevExpressions.map((e) => {
        if (isFunctionA(e) || isFunctionB(e)) {
          return t.parenthesizedExpression(e);
        }
        return e;
      });
      const definition = expCopy[expCopy.length - 1];
      const sp = path.getStatementParent();

      if (t.isFunctionDeclaration(sParent.node)) {
        const { id, params, body } = sParent.node;
        return;
        // sParent.replaceWith(
        //   functionDeclaration(
        //     id,
        //     params,
        //     blockStatement([
        //       // ...body.body.map((e) => {
        //       //   if (t.isStatement(e)) return e;
        //       //   return t.expressionStatement(e);
        //       // }),
        //       ...prevExpressions.map((e) => {
        //         if (t.isStatement(e)) return e;
        //         return t.expressionStatement(e);
        //       }),
        //       t.expressionStatement(definition),
        //     ])
        //   )
        // );
      } else {
        sParent.insertBefore(prevExpressions);
        path.replaceWith(definition);
      }
    },
    ...expandVarDecs(),
  });
  return ast;
};
