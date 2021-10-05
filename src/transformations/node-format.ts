import { Visitor } from '@babel/traverse';
import {
  blockStatement,
  booleanLiteral,
  forStatement,
  ifStatement,
  isBlockStatement,
  isNumericLiteral,
} from '@babel/types';

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
      let changed = false;
      if (node.extra) {
        type extra = {
          rawValue: Number;
          raw: string;
        };
        let { rawValue, raw } = <extra>node.extra;
        if (rawValue.toString() !== raw) {
          node.extra = {
            rawValue: node.value,
            raw: node.value.toString(),
          };
          changed = true;
        }
      }

      if (node.value % 16 === 15 || node.value >= 100000) {
        node.extra = {
          rawValue: node.value,
          raw: '0x' + node.value.toString(16).toUpperCase(),
        };
        changed = true;
      }
      if (!changed) return;
      path.replaceWith(node);
    },
  };
};

export const addLoopBody = (): Visitor => {
  return {
    ForStatement(path) {
      const { node } = path;
      const { init, test, update, body } = node;
      if (isBlockStatement(body)) return;

      const block = blockStatement([body]);
      path.replaceWith(forStatement(init, test, update, block));
    },
  };
};

export const addIfStatementBody = (): Visitor => {
  return {
    IfStatement(path) {
      const { node } = path;
      const { test, consequent, alternate } = node;
      if (isBlockStatement(consequent)) return;

      const block = blockStatement([consequent]);
      path.replaceWith(ifStatement(test, block, alternate));
    },
  };
};
