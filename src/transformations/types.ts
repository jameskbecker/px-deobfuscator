import {
  Expression,
  Identifier,
  isCallExpression,
  isFunctionExpression,
  isMemberExpression,
  isNumericLiteral,
  isUpdateExpression,
  UnaryExpression,
} from '@babel/types';
import config from '../config';
export const isVoid0 = (node: UnaryExpression) => {
  const { operator, argument } = node;
  return operator === 'void' && isNumericLiteral(argument) && argument.value === 0;
};

/** @description Checks if CallExpression is call to function that decodes string using 7 character "chart" */
export const isChartEncodedString = (callee: Identifier) => {
  return callee.name === config.chart;
};

export const isStandardEncodedString = (callee: Identifier) => {
  return callee.name === config.standard;
};

/** @description Checks if CallExpression is call to function that decodes string from Base64 */
export const isB64Call = (callee: Identifier) => {
  return callee.name === config.atob.wrapper;
};

export const isFunctionA = (e: Expression) => isCallExpression(e) && isFunctionExpression(e.callee);
export const isFunctionB = (e: Expression) =>
  isUpdateExpression(e) &&
  isMemberExpression(e.argument) &&
  isCallExpression(e.argument.object) &&
  isFunctionExpression(e.argument.object.callee);
