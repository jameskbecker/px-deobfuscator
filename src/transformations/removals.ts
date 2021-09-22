import traverse from '@babel/traverse';
import {
  File,
  isIdentifier,
  isLiteral,
  isUnaryExpression,
  isVariableDeclarator,
  numericLiteral,
  stringLiteral,
  variableDeclaration,
} from '@babel/types';
import { prefix } from '../config';
import { isVoid0 } from './types';

/** Removes constant variables and relaces its refrences with definition
 * @requires expandSequenceExpressions to be run
 */
export const removeRedudantStringVars = (ast: File) => {
  console.log('Removing Redundant String Variables');
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
  console.log('Removing function redefinitions (1/2)');
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

  console.log('Removing function redefinitions (2/2)');
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
