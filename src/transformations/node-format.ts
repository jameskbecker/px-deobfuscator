import { Visitor } from '@babel/traverse';
import { booleanLiteral, isNumericLiteral } from '@babel/types';

export const booleanExpressions = (): Visitor => {
  return {
    UnaryExpression(path) {
      const { node } = path;
      const { operator, argument } = node;
      if (operator !== '!') return;
      if (!isNumericLiteral(argument)) return;

      let value;
      switch (argument.value) {
        case 0:
          value = true;
          break;
        case 1:
          value = false;
          break;
        default:
          return;
      }
      path.replaceWith(booleanLiteral(value));
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
