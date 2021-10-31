import traverse from '@babel/traverse';
import * as t from '@babel/types';

/**
 * move down scope until referenced
 * once not reference move into parent scope of that scope
 * 
 */

export const rescope = (ast:t.File) => {
  traverse(ast, {
    FunctionDeclaration(path) {
      const { node, scope } = path;
      
      const { id } = node;
      if (!t.isIdentifier(id)) return;

      const binding = scope.getBinding(id.name);
      if (!binding) return;

      const { constant, references, referencePaths } = binding;
      if (!constant || references !== 1 || !referencePaths[0]) return;

      //
      const fParent = path.getFunctionParent();
      const refParent = referencePaths[0].getFunctionParent();

      if (!fParent || !refParent) return;
      if (!t.isFunctionDeclaration(fParent.node) || !t.isFunctionDeclaration(refParent.node)) return;

      //if (fParent !== refParent) {
      console.log('hello');
      const { id: id2, body, params } = <t.FunctionDeclaration>refParent.node;

      if (!t.isBlockStatement(body)) return;
      const body2 = body.body;
      refParent.replaceWith(t.functionDeclaration(id2, params, t.blockStatement([node, ...body2])));
      path.remove();
      //}
    },
  });
  return ast;
}