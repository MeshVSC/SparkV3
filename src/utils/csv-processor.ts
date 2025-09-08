import Papa from 'papaparse';

export interface CsvParseOptions {
  header?: boolean;
  delimiter?: string;
  skipEmptyLines?: boolean;
  transformHeader?: (header: string) => string;
  transform?: (value: string, field: string | number) => any;
}

export interface CsvParseResult<T = any> {
  success: boolean;
  data?: T[];
  errors?: Papa.ParseError[];
  meta?: Papa.ParseMeta;
  errorMessage?: string;
}

export interface CsvStringifyOptions {
  delimiter?: string;
  header?: boolean;
  columns?: string[];
  quotes?: boolean | boolean[];
  quoteChar?: string;
  escapeChar?: string;
  newline?: string;
}

export interface CsvStringifyResult {
  success: boolean;
  csv?: string;
  error?: string;
}

/**
 * Parse CSV string into structured data
 */
export function parseCsvString<T = any>(
  csvString: string,
  options: CsvParseOptions = {}
): CsvParseResult<T> {
  try {
    const {
      header = true,
      delimiter = ',',
      skipEmptyLines = true,
      transformHeader,
      transform,
    } = options;

    const parseResult = Papa.parse<T>(csvString, {
      header,
      delimiter,
      skipEmptyLines,
      transformHeader,
      transform,
      complete: (results) => results,
      error: (error) => error,
    });

    if (parseResult.errors.length > 0) {
      return {
        success: false,
        errors: parseResult.errors,
        errorMessage: parseResult.errors.map(err => err.message).join('; '),
      };
    }

    return {
      success: true,
      data: parseResult.data,
      meta: parseResult.meta,
    };
  } catch (error) {
    return {
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Parse CSV file into structured data
 */
export function parseCsvFile<T = any>(
  file: File,
  options: CsvParseOptions = {}
): Promise<CsvParseResult<T>> {
  return new Promise((resolve) => {
    try {
      const {
        header = true,
        delimiter = ',',
        skipEmptyLines = true,
        transformHeader,
        transform,
      } = options;

      Papa.parse<T>(file, {
        header,
        delimiter,
        skipEmptyLines,
        transformHeader,
        transform,
        complete: (results) => {
          if (results.errors.length > 0) {
            resolve({
              success: false,
              errors: results.errors,
              errorMessage: results.errors.map(err => err.message).join('; '),
            });
            return;
          }

          resolve({
            success: true,
            data: results.data,
            meta: results.meta,
          });
        },
        error: (error) => {
          resolve({
            success: false,
            errorMessage: error instanceof Error ? error.message : 'Failed to parse file',
          });
        },
      });
    } catch (error) {
      resolve({
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    }
  });
}

/**
 * Convert structured data to CSV string
 */
export function stringifyToCsv<T = any>(
  data: T[],
  options: CsvStringifyOptions = {}
): CsvStringifyResult {
  try {
    const {
      delimiter = ',',
      header = true,
      columns,
      quotes = false,
      quoteChar = '"',
      escapeChar = '"',
      newline = '\r\n',
    } = options;

    const config: Papa.UnparseConfig = {
      delimiter,
      header,
      columns,
      quotes,
      quoteChar,
      escapeChar,
      newline,
    };

    const csv = Papa.unparse(data, config);

    return {
      success: true,
      csv,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Convert array of objects to CSV with custom field mapping
 */
export function objectArrayToCsv<T extends Record<string, any>>(
  data: T[],
  fieldMapping?: Record<keyof T, string>,
  options: CsvStringifyOptions = {}
): CsvStringifyResult {
  try {
    if (data.length === 0) {
      return {
        success: true,
        csv: '',
      };
    }

    // Apply field mapping if provided
    let processedData = data;
    if (fieldMapping) {
      processedData = data.map(item => {
        const mappedItem: Record<string, any> = {};
        Object.entries(fieldMapping).forEach(([originalKey, displayKey]) => {
          mappedItem[displayKey] = item[originalKey];
        });
        return mappedItem;
      });
    }

    return stringifyToCsv(processedData, options);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Validate CSV structure against expected columns
 */
export function validateCsvStructure(
  csvData: any[],
  expectedColumns: string[]
): { isValid: boolean; missingColumns: string[]; extraColumns: string[] } {
  if (csvData.length === 0) {
    return {
      isValid: false,
      missingColumns: expectedColumns,
      extraColumns: [],
    };
  }

  const actualColumns = Object.keys(csvData[0]);
  const missingColumns = expectedColumns.filter(col => !actualColumns.includes(col));
  const extraColumns = actualColumns.filter(col => !expectedColumns.includes(col));

  return {
    isValid: missingColumns.length === 0,
    missingColumns,
    extraColumns,
  };
}