import { Visitor } from '@babel/traverse';
import { booleanLiteral, isNumericLiteral } from '@babel/types';

export const booleanExpressions = (): Visitor => {
  return {
    UnaryExpression(path) {
      const { node } = path;
      if (node.operator !== '!') return;
      if (!isNumericLiteral(node.argument)) return;

      path.replaceWith(booleanLiteral(Boolean(node.argument.value)));
    },
  };
};

/** @description converts NumericLiteral nodes to hex form if >= 100000000 */
export const bigIntToHex = (): Visitor => {
  return {
    NumericLiteral(path) {
      const { node } = path;
      if (node.value >= 10000) {
        node.extra = {
          rawValue: node.value,
          raw: '0x' + node.value.toString(16).toUpperCase(),
        };
        path.replaceWith(node);
      }
    },
  };
};
