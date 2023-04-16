import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import AWS from 'aws-sdk';

AWS.config.update({
  region: 'us-west-1',
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const dynamoTableName = 'User';
const healthPath = '/health';
const userPath = '/user';
const usersPath = '/users';

export async function handler(event) {
  console.log('Request event: ', event);
  let response;
  switch (true) {
    case event.httpMethod === 'GET' && event.path === healthPath:
      response = buildResponse(200, 'success');
      break;
    case event.httpMethod === 'GET' && event.path === userPath:
      response = await getUser(event.queryStringParameters?.userId);
      break;
    case event.httpMethod === 'GET' && event.path === usersPath:
      response = await getUsers();
      break;
    case event.httpMethod === 'POST' && event.path === userPath:
      response = await saveUser(JSON.parse(event.body));
      break;
    case event.httpMethod === 'PATCH' && event.path === userPath:
      const requestBody = JSON.parse(event.body);
      response = await modifyUser(requestBody.budgetId, requestBody.updateKey, requestBody.updateValue);
      break;
    default:
      response = buildResponse(404, '404 Not Found');
  }
  return response;
}

async function getUser(userId) {
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
    return buildResponse(500, 'Internal Server Error');
  }
}

async function getUsers() {
  const params = {
    TableName: dynamoTableName
  };
  try {
    const allUsers = await scanDynamoRecords(params, []);
    const body = {
      users: allUsers
    };
    return buildResponse(200, body);
  } catch (error) {
    console.error('Do your custom error handling here. I am just gonna log it: ', error);
    return buildResponse(500, 'Internal Server Error');
  }
}

async function scanDynamoRecords(scanParams, itemArray) {
  try {
    const dynamoData = await dynamodb.scan(scanParams).promise();
    itemArray = itemArray.concat(dynamoData.Items);
    if (dynamoData.LastEvaluatedKey) {
      scanParams.ExclusiveStartKey = dynamoData.LastEvaluatedKey;
      return await scanDynamoRecords(scanParams, itemArray);
    }
    return itemArray;
  } catch (error) {
    console.error('Do your custom error handling here. I am just gonna log it: ', error);
    return buildResponse(500, 'Internal Server Error');
  }
}

const saveUser = async (requestBody) => {
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
  }
}

const modifyUser = async (userId, updateKey, updateValue) => {
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
  }
}

const buildResponse = (statusCode, body) => {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  };
}