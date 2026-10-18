import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { IDatabase } from "../interfaces";
import {
  GetCommand,
  ScanCommand,
  PutCommand,
  UpdateCommand,
  DynamoDBDocumentClient,
} from "@aws-sdk/lib-dynamodb";
import { Category, Order, Product, User, UserPatchRequest } from "../types";

export default class DynamoDB implements IDatabase {
  docClient: DynamoDBDocumentClient;

  constructor() {
    const client = new DynamoDBClient({ region: process.env.AWS_REGION });
    this.docClient = DynamoDBDocumentClient.from(client);
    console.log("DynamoDB connected!");
  }

  async queryRandomProduct() {
    // retrieve products
    const command = new ScanCommand({
      TableName: "Products",
    });
    const response = await this.docClient.send(command);

    let products: Product[] = [];
    if (response.Items) {
      products = response.Items as Product[];
    }

    // no products
    if (products.length === 0) {
      throw new Error("No products found");
    }

    // randomly pick a product
    const randomProductIdx = Math.floor(Math.random() * products.length);
    return products[randomProductIdx];
  }

  async queryProductById(productId: string) {
    const command = new GetCommand({
      TableName: "Products",
      Key: {
        id: productId,
      },
    });

    const response = await this.docClient.send(command);
    return response.Item as Product;
  }

  async queryAllProducts(category?: string) {
    // retrieve products filtered by category if given
    let command: ScanCommand;
    if (category !== undefined) {
      command = new ScanCommand({
        TableName: "Products",
        FilterExpression: "categoryId = :category",
        ExpressionAttributeValues: {
          ":category": category,
        },
      });
    } else {
      command = new ScanCommand({
        TableName: "Products",
      });
    }

    const response = await this.docClient.send(command);

    let products: Product[] = [];
    if (response.Items) {
      products = response.Items as Product[];
    }

    return products;
  }

  async queryAllCategories() {
    const command = new ScanCommand({
      TableName: "Categories",
    });

    const response = await this.docClient.send(command);
    return response.Items as Category[];
  }

  async queryAllOrders() {
    const command = new ScanCommand({
      TableName: "Orders",
    });

    const response = await this.docClient.send(command);
    return response.Items as Order[];
  }

  async queryOrdersByUser(userId) {
    const command = new ScanCommand({
      TableName: "Orders",
      FilterExpression: "userId = :userId",
      ExpressionAttributeValues: {
        ":userId": userId,
      },
    });

    const response = await this.docClient.send(command);
    return response.Items as Order[];
  }

  async queryOrderById(userId) {
    const command = new GetCommand({
      TableName: "Orders",
      Key: {
        id: userId,
      },
    });

    const response = await this.docClient.send(command);
    return response.Item as Order;
  }

  async queryUserById(userId) {
    const command = new GetCommand({
      TableName: "Users",
      Key: {
        id: userId,
      },
      ProjectionExpression: "id, #n, email",
      ExpressionAttributeNames: { "#n": "name" },
    });

    const response = await this.docClient.send(command);
    return response.Item as User;
  }

  async queryAllUsers() {
    const command = new ScanCommand({
      TableName: "Users",
      ProjectionExpression: "id, #n, email",
      ExpressionAttributeNames: { "#n": "name" },
    });

    const response = await this.docClient.send(command);
    return response.Items as User[];
  }

  async insertOrder(order: Order): Promise<void> {
    const command = new PutCommand({
      TableName: "Orders",
      Item: order,
    });

    await this.docClient.send(command);
  }

  async updateUser(patch: UserPatchRequest): Promise<void> {
    let command: UpdateCommand;

    // update both email and password
    if (patch.email !== undefined && patch.password !== undefined) {
      command = new UpdateCommand({
        TableName: "Users",
        Key: { id: patch.id },
        UpdateExpression: "SET email = :email, #password = :password",
        ExpressionAttributeNames: { "#password": "password" },
        ExpressionAttributeValues: {
          ":email": patch.email,
          ":password": patch.password,
        },
      });
    }

    // update only email
    else if (patch.email !== undefined) {
      command = new UpdateCommand({
        TableName: "Users",
        Key: { id: patch.id },
        UpdateExpression: "SET email = :email",
        ExpressionAttributeValues: { ":email": patch.email },
      });
    }

    // update only password
    else if (patch.password !== undefined) {
      command = new UpdateCommand({
        TableName: "Users",
        Key: { id: patch.id },
        UpdateExpression: "SET #password = :password",
        ExpressionAttributeNames: { "#password": "password" },
        ExpressionAttributeValues: { ":password": patch.password },
      });
    }

    // no updates
    else {
      return;
    }

    await this.docClient.send(command);
  }
}
