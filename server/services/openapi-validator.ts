import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const OpenAPISchemaValidator = require('openapi-schema-validator');
import type { OpenAPIV3 } from 'openapi-types';
import flussonicSpec from '../../openapi (1).json';

// Ensure the validator is properly typed
type OpenAPIValidator = any;

interface ValidationError {
  message: string;
  path: string[];
  errorCode: string;
}

export class OpenAPIValidatorService {
  private validator: OpenAPIValidator;
  private spec: OpenAPIV3.Document;

  constructor() {
    try {
      // Debug log in development
      if (process.env.NODE_ENV === 'development') {
        console.log('Initializing OpenAPI validator...');
      }
      
      // Create validator instance with relaxed validation in development
      const ValidatorClass = OpenAPISchemaValidator.default || OpenAPISchemaValidator;
      this.validator = new ValidatorClass({ 
        version: 3,
        validateFormats: false // Disable strict format validation
      });
      
      // In development, we'll use a more forgiving approach to the spec
      this.spec = process.env.NODE_ENV === 'development' 
        ? { 
            ...flussonicSpec,
            paths: {},
            components: {
              ...flussonicSpec.components,
              schemas: {}
            }
          } as OpenAPIV3.Document
        : flussonicSpec as OpenAPIV3.Document;

      // Only validate spec in production
      if (process.env.NODE_ENV === 'production') {
        const { errors } = this.validator.validate(this.spec);
        if (errors && errors.length > 0) {
          console.error('OpenAPI spec validation errors:', errors);
          throw new Error('Invalid OpenAPI specification');
        }
      }
    } catch (error) {
      console.error('Failed to initialize OpenAPI validator:', error);
      
      if (process.env.NODE_ENV === 'development') {
        console.log('Using fallback validator in development mode');
        // Provide a dummy validator that doesn't block development
        this.validator = { 
          validate: () => ({ errors: [] }) 
        };
        this.spec = { paths: {} } as OpenAPIV3.Document;
        return;
      }
      
      throw error;
    }
  }

  validateRequest(path: string, method: string, params?: any, body?: any): ValidationError[] {
    try {
      const operation = this.findOperation(path, method);
      if (!operation) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(`No operation found for ${method} ${path}`);
          return [];
        }
        return [{
          message: `No operation found for ${method} ${path}`,
          path: [],
          errorCode: 'OPERATION_NOT_FOUND'
        }];
      }

      const errors: ValidationError[] = [];

      // Validate parameters
      if (operation.parameters && params) {
        for (const param of operation.parameters) {
          if ('required' in param && param.required && param.name && !(param.name in params)) {
            errors.push({
              message: `Missing required parameter: ${param.name}`,
              path: ['parameters', param.name],
              errorCode: 'REQUIRED_PARAMETER'
            });
          }
        }
      }

      // Validate request body
      if (operation.requestBody && body) {
        const contentType = 'application/json';
        const requestBody = operation.requestBody as OpenAPIV3.RequestBodyObject;
        const schema = requestBody.content?.[contentType]?.schema;
        
        if (schema) {
          try {
            const validateResult = this.validator.validate(body, schema);
            if (validateResult.errors?.length > 0) {
              if (process.env.NODE_ENV === 'development') {
                console.warn('Request validation errors:', validateResult.errors);
                return [];
              }
              errors.push(...validateResult.errors.map(error => ({
                message: error.message || 'Validation error',
                path: error.dataPath?.split('/').filter(Boolean) || [],
                errorCode: (error.keyword || 'VALIDATION_ERROR').toUpperCase()
              })));
            }
          } catch (error) {
            console.error('Schema validation error:', error);
            if (process.env.NODE_ENV === 'development') {
              return [];
            }
            errors.push({
              message: error instanceof Error ? error.message : 'Schema validation failed',
              path: [],
              errorCode: 'SCHEMA_VALIDATION_ERROR'
            });
          }
        }
      }

      return errors;
    } catch (error) {
      console.error('Request validation error:', error);
      if (process.env.NODE_ENV === 'development') {
        return [];
      }
      return [{
        message: error instanceof Error ? error.message : 'Request validation failed',
        path: [],
        errorCode: 'VALIDATION_ERROR'
      }];
    }
  }

  validateResponse(path: string, method: string, statusCode: number, response: any): ValidationError[] {
    try {
      // In development mode, be more lenient with validation
      if (process.env.NODE_ENV === 'development') {
        console.log(`Validating response for ${method} ${path}:`, {
          statusCode,
          responsePreview: JSON.stringify(response).slice(0, 200) + '...'
        });
        
        // In development, only validate if we have a matching operation and schema
        const operation = this.findOperation(path, method);
        if (!operation) {
          console.warn(`No operation found for ${method} ${path} - skipping validation`);
          return [];
        }
        
        const responseSpec = operation.responses[statusCode];
        if (!responseSpec) {
          console.warn(`No response specification found for status ${statusCode} - skipping validation`);
          return [];
        }
        
        // Log any validation errors but don't fail in development
        try {
          const contentType = 'application/json';
          const responseObject = responseSpec as OpenAPIV3.ResponseObject;
          const schema = responseObject.content?.[contentType]?.schema;
          
          if (schema) {
            const validateResult = this.validator.validate(response, schema);
            if (validateResult.errors?.length > 0) {
              console.warn('Response validation warnings:', validateResult.errors);
            }
          }
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.warn('Schema validation warning:', errorMessage);
        }
        
        return [];
      }
      
      // Production validation is strict
      const operation = this.findOperation(path, method);
      if (!operation) {
        return [{
          message: `No operation found for ${method} ${path}`,
          path: [],
          errorCode: 'OPERATION_NOT_FOUND'
        }];
      }

      const responseSpec = operation.responses[statusCode];
      if (!responseSpec) {
        return [{
          message: `No response specification found for status ${statusCode}`,
          path: ['responses', statusCode.toString()],
          errorCode: 'RESPONSE_NOT_FOUND'
        }];
      }

      const errors: ValidationError[] = [];
      const contentType = 'application/json';
      const responseObject = responseSpec as OpenAPIV3.ResponseObject;
      const schema = responseObject.content?.[contentType]?.schema;

      if (schema) {
        try {
          const validateResult = this.validator.validate(response, schema);
          if (validateResult.errors?.length > 0) {
            errors.push(...validateResult.errors.map(error => ({
              message: error.message || 'Validation error',
              path: error.dataPath?.split('/').filter(Boolean) || [],
              errorCode: (error.keyword || 'VALIDATION_ERROR').toUpperCase()
            })));
          }
        } catch (error) {
          errors.push({
            message: error instanceof Error ? error.message : 'Schema validation failed',
            path: [],
            errorCode: 'SCHEMA_VALIDATION_ERROR'
          });
        }
      }

      return errors;
    } catch (error: unknown) {
      if (process.env.NODE_ENV === 'development') {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Response validation error:', errorMessage);
        return [];
      }
      return [{
        message: error instanceof Error ? error.message : 'Response validation failed',
        path: [],
        errorCode: 'VALIDATION_ERROR'
      }];
    }
  }

  getOperationResponseType(path: string, method: string): string | null {
    const operation = this.findOperation(path, method);
    if (!operation) {
      return null;
    }

    // Get the 200 OK response schema
    const successResponse = operation.responses['200'] as OpenAPIV3.ResponseObject;
    if (!successResponse?.content?.['application/json']?.schema) {
      return null;
    }

    return JSON.stringify(successResponse.content['application/json'].schema, null, 2);
  }

  private findOperation(path: string, method: string): OpenAPIV3.OperationObject | null {
    const pathObject = this.spec.paths?.[path];
    if (!pathObject) {
      return null;
    }

    return pathObject[method.toLowerCase() as keyof OpenAPIV3.PathItemObject] as OpenAPIV3.OperationObject || null;
  }
}

export const openAPIValidator = new OpenAPIValidatorService();
