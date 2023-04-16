import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';

const dynamodb = new DynamoDB.DocumentClient();
const dynamoTableName = 'User';
const healthPath = '/health';
const userPath = '/user';
const usersPath = '/users';

interface Event {
  httpMethod: string;
  path: string;
  queryStringParameters?: {
    userId: string;
  };
  body?: string;
}

interface ResponseBody {
  Operation?: string;
  Message?: string;
  Item?: Record<string, any>;
  UpdatedAttribute?: Record<string, any>;
  users?: Record<string, any>[];
}

exports.handler = async (event: Event): Promise<{ statusCode: number; headers: { 'Content-Type': string }; body: string }> => {
  console.log('Request event: ', event);
  let response;
  switch (true) {
    case event.httpMethod === 'GET' && event.path === healthPath:
      response = buildResponse(200);
      break;
    case event.httpMethod === 'GET' && event.path === userPath:
      response = await getUser(event.queryStringParameters?.userId);
      break;
    case event.httpMethod === 'GET' && event.path === usersPath:
      response = await getUsers();
      break;
    case event.httpMethod === 'POST' && event.path === userPath:
      response = await saveUser(JSON.parse(event.body!));
      break;
    case event.httpMethod === 'PATCH' && event.path === userPath:
      const requestBody = JSON.parse(event.body!);
      response = await modifyUser(requestBody.budgetId, requestBody.updateKey, requestBody.updateValue);
      break;
    default:
      response = buildResponse(404);
  }
  return response;
}

const getUser = async (userId: string | undefined): Promise<any> => {
  const params = {
    TableName: dynamoTableName,
    Key: {
      'userId': userId
    }
  };
  try {
    const response = await dynamodb.get(params).promise();
    return buildResponse(200, response.Item);
  } catch (error) {
    console.error('Do your custom error handling here. I am just gonna log it: ', error);
    return buildResponse(500);
  }
}

const getUsers = async (): Promise<any> => {
  const params = {
    TableName: dynamoTableName
  };
  try {
    const allUsers = await scanDynamoRecords(params, []);
    const body: ResponseBody = {
      users: allUsers
    };
    return buildResponse(200, body);
  } catch (error) {
    console.error('Do your custom error handling here. I am just gonna log it: ', error);
    return buildResponse(500);
  }
}

const scanDynamoRecords = async (scanParams: DynamoDB.DocumentClient.ScanInput, itemArray: Record<string, any>[]): Promise<any> =>{
  try {
    const dynamoData = await dynamodb.scan(scanParams).promise();
    itemArray = itemArray.concat(dynamoData.Items!);
    if (dynamoData.LastEvaluatedKey) {
      scanParams.ExclusiveStartKey = dynamoData.LastEvaluatedKey;
      return await scanDynamoRecords(scanParams, itemArray);
    }
    return itemArray;
  } catch (error) {
    console.error('Do your custom error handling here. I am just gonna log it: ', error);
    return buildResponse(500);
  }
}

const saveUser = async (requestBody: any): Promise<APIGatewayProxyResult> => {
  const params = {
    TableName: dynamoTableName,
    Item: requestBody
  };
  try {
    await dynamodb.put(params).promise();
    const body = {
      Operation: 'SAVE',
      Message: 'SUCCESS',
      Item: requestBody
    };
    return buildResponse(200, body);
  } catch (error) {
    console.error('Do your custom error handling here. I am just gonna log it: ', error);
    return buildResponse(500);
  }
};

const modifyUser = async (userId: string, updateKey: string, updateValue: any): Promise<APIGatewayProxyResult> => {
  const params = {
    TableName: dynamoTableName,
    Key: {
      'userId': userId
    },
    UpdateExpression: `set ${updateKey} = :value`,
    ExpressionAttributeValues: {
      ':value': updateValue
    },
    ReturnValues: 'UPDATED_NEW'
  };
  try {
    const response = await dynamodb.update(params).promise();
    const body = {
      Operation: 'SAVE',
      Message: 'SUCCESS',
      UpdatedAttribute: response
    };
    return buildResponse(200, body);
  } catch (error) {
    console.error('Do your custom error handling here. I am just gonna log it: ', error);
    return buildResponse(500);
  }
};

const buildResponse = (statusCode: number, body?: ResponseBody): APIGatewayProxyResult => {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json'
    },
    body: body === undefined ? "" : JSON.stringify(body)
  };
};