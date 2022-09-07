import * as colors from 'colors';

export enum LogLevel {
  Error,
  Success,
  Info,
  Debug,
}

function colorOutput(
  method: (a: string) => string,
  logMsg: string,
  message: string
) {
  console.log(`[${method(logMsg)}] ${message}`);
}

export function log(logLevel: LogLevel, message: string) {
  switch (logLevel) {
    case LogLevel.Error: {
      colorOutput(colors.red, 'ERROR', message);
      break;
    }
    case LogLevel.Success: {
      colorOutput(colors.green, 'SUCCESS', message);
      break;
    }
    case LogLevel.Info: {
      colorOutput(colors.blue, 'INFO', message);
      break;
    }
    case LogLevel.Debug: {
      colorOutput(colors.cyan, 'DEBUG', message);
      break;
    }
  }
}
