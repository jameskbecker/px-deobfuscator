import traverse, { Visitor } from '@babel/traverse';
import { File, isIdentifier, isStringLiteral, stringLiteral } from '@babel/types';
import config from '../config';
import { b64Decode, chartDecode, standardDecode } from '../utils';
import { isB64Call, isChartEncodedString, isStandardEncodedString } from './types';

/** @description Finds chart value needed for "chartDecode" by locating labeled decode function
 * @returns chart value
 */
export const getChartValue = (ast: File): string => {
  let chart = '';
  const x: Visitor = {
    StringLiteral(p2) {
      if (p2.node.value.length === 7) {
        chart = p2.node.value;
      }
    },
  };

  console.log('Finding String Decode Chart Value');
  traverse(ast, {
    FunctionDeclaration(path) {
      if (isIdentifier(path.node.id) && path.node.id.name === config.chart) {
        path.traverse(x);
      }
    },
  });

  if (!chart) {
    throw new Error('Unable to Find Chart');
  }

  return chart;
};

/** @description Visits string decode calls and replaces them with decoded string */
export const visitStringDecodeCalls = (chart: string): Visitor => {
  return {
    CallExpression(path) {
      const { node } = path;
      let decodedValue = '';
      if (
        !isIdentifier(node.callee) ||
        node.arguments.length !== 1 ||
        !isStringLiteral(node.arguments[0])
      )
        return;

      const { callee } = node;
      if (isChartEncodedString(callee)) {
        return;
        // decodedValue = chartDecode(node.arguments[0].value, chart);
      } else if (isStandardEncodedString(callee)) {
        return;
        //decodedValue = standardDecode(node.arguments[0].value);
      } else if (isB64Call(callee)) {
        decodedValue = b64Decode(node.arguments[0].value);
      } else return;

      path.replaceWith(stringLiteral(decodedValue));
    },
  };
};

/** @description Visits string decode calls and replaces them with decoded string */
export const visitStringDecodeCalls2 = (chart: string): Visitor => {
  return {
    CallExpression(path) {
      const { node } = path;
      let decodedValue = '';
      if (
        !isIdentifier(node.callee) ||
        node.arguments.length !== 1 ||
        !isStringLiteral(node.arguments[0])
      )
        return;

      const { callee } = node;
      if (isStandardEncodedString(callee)) {
        decodedValue = standardDecode(node.arguments[0].value);
      } else if (isChartEncodedString(callee)) {
        decodedValue = chartDecode(node.arguments[0].value, chart);
      } else return;

      path.replaceWith(stringLiteral(decodedValue));
    },
  };
};

// /** @description Visits string decode calls and replaces them with decoded string */
// export const visitAtobCalls = (chart: string): Visitor => {
//   return {
//     CallExpression(path) {
//       const { node } = path;
//       let decodedValue = '';
//       if (!isIdentifier(node.callee) || node.arguments.length !== 1 || !isStringLiteral(node.arguments[0])) return;

//       const { callee } = node;
//       if (isEncodedString(callee)) {
//         decodedValue = chartDecode(node.arguments[0].value, chart);
//       } else if (isB64Call(callee)) {
//         decodedValue = b64Decode(node.arguments[0].value);
//       }
//       if (!decodedValue) return;
//       path.replaceWith(stringLiteral(decodedValue));
//     },
//   };
// };
