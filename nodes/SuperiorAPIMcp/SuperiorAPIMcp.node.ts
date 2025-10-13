/* eslint-disable n8n-nodes-base/node-filename-against-convention */
/* eslint-disable n8n-nodes-base/node-param-options-type-unsorted-items */
/* eslint-disable @typescript-eslint/no-var-requires */
import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IDataObject,
	IHttpRequestOptions,
	NodeApiError,
	JsonObject,
} from 'n8n-workflow';

const https = require('https');
const http = require('http');
const { URL } = require('url');

/**
 * SuperiorAPIMcp Node - MCP 協議專用節點
 *
 * 功能：與 Model Context Protocol (MCP) 服務器交互
 * 支援：SSE 和 HTTP 兩種傳輸方式
 */
export class SuperiorAPIMcp implements INodeType {
	// ==================== Node 基本配置 ====================
	description: INodeTypeDescription = {
		// Node 顯示名稱
		displayName: 'SuperiorAPIs (MCP)',

		// Node 內部識別名稱
		name: 'superiorApiMcp',

		// Node 圖標
		icon: 'file:superiorapis.svg',

		// Node 分類
		group: ['transform'],

		// Node 版本號
		version: 1,

		// 子標題（動態顯示當前選擇的操作）
		subtitle: '={{$parameter["connectionType"] + ": " + $parameter["operation"]}}',

		// Node 描述文字
		description: 'Interact with Model Context Protocol (MCP) servers via SSE or HTTP',

		// 默認值配置
		defaults: {
			name: 'SuperiorAPIs (MCP)',
		},

		// 輸入端點
		inputs: ['main'],

		// 輸出端點
		outputs: ['main'],

		// ==================== 認證配置 ====================
		credentials: [
			{
				name: 'superiorAPISseApi',
				required: false,
				displayOptions: {
					show: {
						connectionType: ['sse'],
					},
				},
			},
			{
				name: 'superiorAPIHttpApi',
				required: false,
				displayOptions: {
					show: {
						connectionType: ['http'],
					},
				},
			},
		],

		// ==================== UI 參數配置 ====================
		properties: [
			// ==================== Connection Type 選擇器 ====================
			{
				displayName: 'Connection Type',
				name: 'connectionType',
				type: 'options',
				options: [
					{
						name: 'Server-Sent Events (SSE)',
						value: 'sse',
						description: 'Use SSE transport for MCP connection',
					},
					{
						name: 'HTTP (JSON-RPC over POST)',
						value: 'http',
						description: 'Use HTTP POST for JSON-RPC communication',
					},
				],
				default: 'sse',
				description: 'Choose the transport type to connect to MCP server',
			},

			// ==================== Operation 選擇器 ====================
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Initialize',
						value: 'initialize',
						action: 'Initialize MCP connection',
						description: 'Initialize MCP connection',
					},
					{
						name: 'List Tools',
						value: 'tools/list',
						action: 'List available tools',
						description: 'List available tools',
					},
					{
						name: 'Call Tool',
						value: 'tools/call',
						action: 'Execute a tool',
						description: 'Execute a tool',
					},
					{
						name: 'List Resources',
						value: 'resources/list',
						action: 'List available resources',
						description: 'List available resources',
					},
					{
						name: 'Read Resource',
						value: 'resources/read',
						action: 'Read a resource',
						description: 'Read a resource',
					},
					{
						name: 'List Prompts',
						value: 'prompts/list',
						action: 'List available prompts',
						description: 'List available prompts',
					},
					{
						name: 'Get Prompt',
						value: 'prompts/get',
						action: 'Get a prompt',
						description: 'Get a prompt',
					},
				],
				default: 'tools/list',
			},

			// ==================== Tool Name 輸入框 ====================
			{
				displayName: 'Tool Name',
				name: 'toolName',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						operation: ['tools/call'],
					},
				},
				default: '',
				placeholder: 'tool_name',
				description: 'Name of the tool to execute',
			},

			// ==================== Resource URI 輸入框 ====================
			{
				displayName: 'Resource URI',
				name: 'resourceUri',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						operation: ['resources/read'],
					},
				},
				default: '',
				placeholder: 'resource://uri',
				description: 'URI of the resource to read',
			},

			// ==================== Prompt Name 輸入框 ====================
			{
				displayName: 'Prompt Name',
				name: 'promptName',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						operation: ['prompts/get'],
					},
				},
				default: '',
				placeholder: 'prompt_name',
				description: 'Name of the prompt to get',
			},

			// ==================== Parameters JSON 編輯器 ====================
			{
				displayName: 'Parameters',
				name: 'parameters',
				type: 'json',
				displayOptions: {
					show: {
						operation: ['tools/call', 'prompts/get'],
					},
				},
				default: '{}',
				description: 'Tool/Prompt parameters as JSON object (supports expressions)',
			},
		],
	};

	/**
	 * ==================== 執行函數 ====================
	 * 當 Node 被觸發時執行的主要邏輯
	 *
	 * 流程：
	 * 1. 獲取輸入數據
	 * 2. 遍歷每個輸入項
	 * 3. 構建 MCP JSON-RPC 請求
	 * 4. 根據連接類型發送請求（SSE 或 HTTP）
	 * 5. 返回結果數據
	 */
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		// 獲取從前一個節點傳入的數據
		const items = this.getInputData();
		// 初始化返回數據數組
		const returnData: INodeExecutionData[] = [];

		// 遍歷每個輸入項
		for (let i = 0; i < items.length; i++) {
			try {
				// 獲取連接類型和操作
				const connectionType = this.getNodeParameter('connectionType', i, 'sse') as string;
				const operation = this.getNodeParameter('operation', i) as string;

				// ==================== 構建 MCP JSON-RPC 請求 ====================
				const mcpRequest: IDataObject = {
					jsonrpc: '2.0',
					method: operation,
					id: Date.now(),
				};

				// 根據不同操作添加參數
				if (operation === 'tools/call') {
					const toolName = this.getNodeParameter('toolName', i) as string;
					const paramsString = this.getNodeParameter('parameters', i, '{}') as string;
					const toolParams = JSON.parse(paramsString);

					mcpRequest.params = {
						name: toolName,
						arguments: toolParams,
					};
				} else if (operation === 'resources/read') {
					const resourceUri = this.getNodeParameter('resourceUri', i) as string;
					mcpRequest.params = { uri: resourceUri };
				} else if (operation === 'prompts/get') {
					const promptName = this.getNodeParameter('promptName', i) as string;
					const paramsString = this.getNodeParameter('parameters', i, '{}') as string;
					const promptParams = JSON.parse(paramsString);

					mcpRequest.params = {
						name: promptName,
						arguments: promptParams,
					};
				}

				let mcpUrl: string;
				let mcpHeaders: IDataObject = {};
				let timeout = 60000;

				// ==================== SSE 傳輸模式 ====================
				if (connectionType === 'sse') {
					// 從認證配置獲取 SSE 連接參數
					const credentials = await this.getCredentials('superiorAPISseApi');
					mcpUrl = credentials.sseUrl as string;
					timeout = (credentials.sseTimeout as number) || 60000;

					// 解析自定義 Headers（格式：key=value，每行一個）
					if (credentials.headers) {
						const headerLines = (credentials.headers as string).split('\n');
						for (const line of headerLines) {
							const equalsIndex = line.indexOf('=');
							if (equalsIndex > 0) {
								const name = line.substring(0, equalsIndex).trim();
								const value = line.substring(equalsIndex + 1).trim();
								if (name && value !== undefined) {
									mcpHeaders[name] = value;
								}
							}
						}
					}

					// 設置 SSE 必需的 Headers
					mcpHeaders['Accept'] = 'text/event-stream';
					mcpHeaders['Cache-Control'] = 'no-cache';
					mcpHeaders['Connection'] = 'keep-alive';
					mcpHeaders['Content-Type'] = 'application/json';

					// 使用原生 HTTP(S) 模塊處理 SSE 流
					const sseData = await handleSSERequest(mcpUrl, mcpRequest, mcpHeaders, timeout);

					returnData.push({
						json: sseData.length === 1
							? sseData[0]
							: {
									messages: sseData,
									messageCount: sseData.length,
								},
						pairedItem: { item: i },
					});
				}
				// ==================== HTTP 傳輸模式 ====================
				else if (connectionType === 'http') {
					// 從認證配置獲取 HTTP 連接參數
					const credentials = await this.getCredentials('superiorAPIHttpApi');
					mcpUrl = credentials.httpStreamUrl as string;
					timeout = (credentials.httpTimeout as number) || 60000;

					// 解析自定義 Headers
					if (credentials.headers) {
						const headerLines = (credentials.headers as string).split('\n');
						for (const line of headerLines) {
							const equalsIndex = line.indexOf('=');
							if (equalsIndex > 0) {
								const name = line.substring(0, equalsIndex).trim();
								const value = line.substring(equalsIndex + 1).trim();
								if (name && value !== undefined) {
									mcpHeaders[name] = value;
								}
							}
						}
					}

					// 設置 JSON-RPC Content-Type
					mcpHeaders['Content-Type'] = 'application/json';

					// 發送 HTTP POST 請求
					const options: IHttpRequestOptions = {
						method: 'POST',
						url: mcpUrl,
						headers: mcpHeaders,
						body: mcpRequest,
						json: true,
						timeout,
						returnFullResponse: false,
					};

					const response = await this.helpers.httpRequest(options);

					returnData.push({
						json: response as IDataObject,
						pairedItem: { item: i },
					});
				}
			} catch (error) {
				// ==================== 錯誤處理 ====================

				// 如果設定為「失敗後繼續」，則將錯誤信息作為輸出
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: (error as Error).message,
						},
						pairedItem: { item: i },
					});
					continue;
				}
				// 否則拋出錯誤，中斷執行
				throw new NodeApiError(this.getNode(), error as JsonObject);
			}
		}

		// 返回所有處理結果
		return [returnData];
	}
}

/**
 * ==================== SSE 請求處理函數 ====================
 *
 * 使用原生 HTTP(S) 模塊處理 SSE 長連接請求
 *
 * @param url - SSE 端點 URL
 * @param jsonRpcRequest - MCP JSON-RPC 請求對象
 * @param headers - 請求 Headers
 * @param timeout - 超時時間（毫秒）
 * @returns 解析後的 SSE 數據陣列
 */
function handleSSERequest(
	url: string,
	jsonRpcRequest: IDataObject,
	headers: IDataObject,
	timeout: number,
): Promise<any[]> {
	return new Promise((resolve, reject) => {
		const urlObj = new URL(url);
		const isHttps = urlObj.protocol === 'https:';
		const httpModule = isHttps ? https : http;

		const requestOptions = {
			hostname: urlObj.hostname,
			port: urlObj.port || (isHttps ? 443 : 80),
			path: urlObj.pathname + urlObj.search,
			method: 'GET',
			headers: headers as any,
		};

		const sseData: any[] = [];
		let buffer = '';
		let timeoutId: any;
		let isResolved = false;

		const req = httpModule.request(requestOptions, (res: any) => {
			// 設置超時
			timeoutId = (setTimeout as any)(() => {
				if (!isResolved) {
					isResolved = true;
					req.destroy();
					// 超時時返回已收集的數據
					resolve(sseData.length > 0 ? sseData : [{ error: 'SSE timeout - no data received' }]);
				}
			}, timeout);

			res.on('data', (chunk: any) => {
				buffer += chunk.toString();

				// 處理完整的 SSE 事件（以雙換行符分隔）
				const events = buffer.split('\n\n');
				// 保留最後一個可能不完整的事件
				buffer = events.pop() || '';

				for (const event of events) {
					if (!event.trim()) continue;

					const lines = event.split('\n');
					for (const line of lines) {
						if (line.startsWith('data: ')) {
							const dataContent = line.substring(6).trim();

							// 檢查結束標記
							if (dataContent === '[DONE]') {
								(clearTimeout as any)(timeoutId);
								if (!isResolved) {
									isResolved = true;
									req.destroy();
									resolve(sseData);
								}
								return;
							}

							// 解析 JSON 數據
							try {
								const jsonData = JSON.parse(dataContent);
								sseData.push(jsonData);

								// 如果收到 JSON-RPC 響應（包含 result 或 error），認為請求完成
								if (jsonData.result !== undefined || jsonData.error !== undefined) {
									(clearTimeout as any)(timeoutId);
									if (!isResolved) {
										isResolved = true;
										req.destroy();
										resolve(sseData);
									}
									return;
								}
							} catch (e) {
								// 忽略無效的 JSON
							}
						}
					}
				}
			});

			res.on('end', () => {
				(clearTimeout as any)(timeoutId);
				if (!isResolved) {
					isResolved = true;
					// 處理緩衝區中剩餘的數據
					if (buffer.trim()) {
						const lines = buffer.split('\n');
						for (const line of lines) {
							if (line.startsWith('data: ')) {
								const dataContent = line.substring(6).trim();
								try {
									const jsonData = JSON.parse(dataContent);
									sseData.push(jsonData);
								} catch (e) {
									// 忽略無效的 JSON
								}
							}
						}
					}
					resolve(sseData);
				}
			});

			res.on('error', (error: Error) => {
				(clearTimeout as any)(timeoutId);
				if (!isResolved) {
					isResolved = true;
					reject(new Error(`SSE response error: ${error.message}`));
				}
			});
		});

		req.on('error', (error: Error) => {
			(clearTimeout as any)(timeoutId);
			if (!isResolved) {
				isResolved = true;
				reject(new Error(`SSE request error: ${error.message}`));
			}
		});

		req.end();
	});
}
