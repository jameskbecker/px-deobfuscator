import generate from '@babel/generator';
import traverse, { Visitor } from '@babel/traverse';
import {
  binaryExpression,
  expressionStatement,
  File,
  identifier,
  isCallExpression,
  isExpression,
  isFunctionExpression,
  isIdentifier,
  isLiteral,
  isReturnStatement,
  isSequenceExpression,
  isStringLiteral,
  isUnaryExpression,
  isUpdateExpression,
  isVariableDeclarator,
  memberExpression,
  numericLiteral,
  returnStatement,
  stringLiteral,
  variableDeclaration,
  variableDeclarator,
  VariableDeclarator,
} from '@babel/types';
import { prefix } from '../config';
import { labelCatchParam } from './labels';
import { isVoid0 } from './types';

export const expandSequenceExpressions = (ast: File) => {
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

  //not sequence expressions; multiple var declarations
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
    },
  });

  traverse(ast, {
    VariableDeclaration(path) {
      const { node } = path;

      const { declarations } = node;
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
  traverse(ast, {
    MemberExpression(path) {
      const { node } = path;
      if (
        //(isIdentifier(node.object) || isCallExpression(node.object) || isMemberExpression(node.object)) &&
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

/** @description Visits VariableDeclaration nodes and if its init node is void0, it removes this as it is the same as 'var x;' */
export const removeRedudantVoidVar = (ast: File) => {
  traverse(ast, {
    VariableDeclaration(path) {
      const { node } = path;
      if (
        node.declarations.length > 0 &&
        isVariableDeclarator(node.declarations[0]) &&
        isUnaryExpression(node.declarations[0].init) &&
        isVoid0(node.declarations[0].init)
      ) {
        const { kind, declarations } = node;
        declarations[0].init = null;
        path.replaceWith(variableDeclaration(kind, declarations));
      }
    },
  });
  return ast;
};

export const removeRedefinitions = (ast: File, name: string) => {
  traverse(ast, {
    VariableDeclarator(path) {
      const { node } = path;
      if (isIdentifier(node.id) && isIdentifier(node.init)) {
        const { id, init } = node;
        if (init.name === prefix + name) {
          path.scope.rename(id.name, prefix + name);
        }
      }
    },
  });

  traverse(ast, {
    VariableDeclarator(path) {
      const { node } = path;
      if (isIdentifier(node.id) && isIdentifier(node.init)) {
        const { id, init } = node;
        if (id.name === init.name) {
          path.remove();
        }
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

/** Removes constant variables and relaces its refrences with definition
 * @requires expandSequenceExpressions to be run
 */
export const removeRedudantStringVars = (ast: File) => {
  traverse(ast, {
    VariableDeclaration(path) {
      const { node } = path;
      if (
        node.declarations.length === 1 && //make sure other declarations not removed
        isVariableDeclarator(node.declarations[0]) &&
        isLiteral(node.declarations[0].init) &&
        isIdentifier(node.declarations[0].id)
      ) {
        const { init, id } = node.declarations[0];
        if (!path.scope.getBinding(id.name)?.constant) {
          return;
        }
        //if (path.scope.getBinding(id.name)?.constant) return;
        try {
          switch (init.type) {
            case 'StringLiteral':
              if (init.value.length === 0) return;
              path.scope
                .getBinding(id.name)
                ?.referencePaths[0].replaceWith(stringLiteral(init.value));
              break;
            case 'NumericLiteral':
              if (!init.value) return;
              path.scope
                .getBinding(id.name)
                ?.referencePaths[0].replaceWith(numericLiteral(init.value));
              break;
            // case 'BooleanLiteral':
            //   path.scope
            //     .getBinding(id.name)
            //     ?.referencePaths[0].replaceWith(booleanLiteral(init.value));
            //   break;
            default:
              //console.log(init.type);
              return;
          }

          path.remove();
        } catch (e) {}
      }
    },
  });
  return ast;
};

export const postGeneral = (ast: File) => {
  traverse(ast, {
    ...cleanVarInitSequence(),
    ...labelCatchParam(),

    BinaryExpression(path) {
      const { node } = path;
      const { operator, left, right } = node;

      //if some kind of literal is on (and only) the left side swich them around
      if (isLiteral(left) && !isLiteral(right) && ['==', '===', '!=', '!=='].includes(operator))
        path.replaceWith(binaryExpression(operator, right, left));
    },
  });
  ast = removeRedudantVoidVar(ast);
  ast = removeRedudantStringVars(ast);
  return ast;
};

//export { preGeneral, postGeneral };
