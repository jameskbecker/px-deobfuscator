import generate from '@babel/generator';
import traverse from '@babel/traverse';
import {
  File,
  isIdentifier,
  isLiteral,
  isParenthesizedExpression,
  isSequenceExpression,
  isUnaryExpression,
  isVariableDeclarator,
  numericLiteral,
  stringLiteral,
  variableDeclaration,
} from '@babel/types';
import { isVoid0 } from './types';

/** Removes constant variables and relaces its refrences with definition
 * @requires expandSequenceExpressions to be run
 */
export const removeRedudantStringVars = (ast: File) => {
  console.log('Removing Redundant String Variables');
  traverse(ast, {
    VariableDeclaration(path) {
      const { node, scope } = path;
      if (
        node.declarations.length === 1 && //make sure other declarations not removed
        isVariableDeclarator(node.declarations[0]) &&
        isLiteral(node.declarations[0].init) &&
        isIdentifier(node.declarations[0].id)
      ) {
        const { init, id } = node.declarations[0];
        const binding = scope.getBinding(id.name);
        if (!binding || !binding.constant) return;

        try {
          switch (init.type) {
            case 'StringLiteral':
              if (init.value.length === 0) return;
              for (let rp of binding.referencePaths) {
                rp.replaceWith(stringLiteral(init.value));
              }

              break;
            case 'NumericLiteral':
              if (!init.value) return;
              for (let rp of binding.referencePaths) {
                rp.replaceWith(numericLiteral(init.value));
              }
              break;

            default:
              //console.log(generate(node).code);
              return;
          }

          path.remove();
        } catch (e) {
          console.log(e);
        }
      }
    },
  });
  return ast;
};

/** @description Visits VariableDeclaration nodes and if its init node is void0, it removes this as it is the same as 'var x;' */
export const removeRedudantVoidVar = (ast: File) => {
  console.log('Removing Redundant Void0 from Variables');
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
  console.log(`Removing ${name} function redefinitions (1/2)`); //renames
  traverse(ast, {
    VariableDeclarator(path) {
      const { node } = path;
      if (!isIdentifier(node.id)) return;

      const { id, init } = node;
      isIdentifier(node.id);
      if (isIdentifier(init) && init.name === name) {
        path.scope.rename(id.name, name);
        path.remove();
      }

      if (isSequenceExpression(init)) {
        const { expressions } = init;
        const last = expressions[expressions.length - 1];
        if (last && isIdentifier(last) && last.name === name) {
          path.scope.rename(id.name, name);
          path.remove();
        }
      }

      if (isParenthesizedExpression(init) && isSequenceExpression(init.expression)) {
        const { expressions } = init.expression;
        const last = expressions[expressions.length - 1];
        if (last && isIdentifier(last) && last.name === name) {
          path.scope.rename(id.name, name);
          path.remove();
        }
      }
    },
  });

  // console.log(`Removing ${name} function redefinitions (2/2)`); //removes
  // traverse(ast, {
  //   VariableDeclarator(path) {
  //     const { node } = path;
  //     if (isIdentifier(node.id) && isIdentifier(node.init)) {
  //       const { id, init } = node;
  //       if (id.name === init.name) {
  //         path.remove();
  //       }
  //     }
  //   },
  // });

  return ast;
};
