import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IDataObject,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	INodePropertyOptions,
	NodeApiError,
	JsonObject,
	NodeOperationError,
	ResourceMapperFields,
	ResourceMapperField,
} from 'n8n-workflow';

/**
 * SuperiorAPIs Node - SuperiorAPIs 平台 API 調用節點
 *
 * 功能:從 SuperiorAPIs 平台選擇並調用 API
 */
export class SuperiorApis implements INodeType {
	// 快取輔助方法 - 取得並快取 plugin 列表
	private async getPluginListCached(context: ILoadOptionsFunctions, token: string): Promise<any> {
		const workflowStaticData = context.getWorkflowStaticData('node');
		const cacheKey = `plugins_list_${token.substring(0, 20)}`; // 使用 token 前 20 字元作為快取鍵
		const cacheTimeKey = `${cacheKey}_timestamp`;
		const CACHE_DURATION = 5 * 60 * 1000; // 5 分鐘快取

		const now = Date.now();
		const cachedTime = workflowStaticData[cacheTimeKey] as number;

		// 檢查快取是否有效
		if (workflowStaticData[cacheKey] && cachedTime && (now - cachedTime < CACHE_DURATION)) {
			return workflowStaticData[cacheKey];
		}

		// 呼叫 API
		const response = await context.helpers.httpRequest({
			method: 'POST',
			url: 'https://superiorapis-creator.cteam.com.tw/manager/module/plugins/list_v3',
			headers: { token },
			json: true,
		});

		// 更新快取
		workflowStaticData[cacheKey] = response;
		workflowStaticData[cacheTimeKey] = now;

		return response;
	}

	// ==================== Node 基本配置 ====================
	description: INodeTypeDescription = {
		// Node 顯示名稱（UI 中顯示的名稱）
		displayName: 'SuperiorAPIs',

		// Node 內部識別名稱（程式碼中使用）
		name: 'superiorApis',

		// Node 圖標（使用本地 SVG 文件）
		icon: 'file:superiorapis.svg',

		// Node 分類（在 n8n 界面中的分類位置）
		group: ['transform'],

		// Node 版本號
		version: 1,

		// 子標題（動態顯示當前選擇的 API 和 Method）
		subtitle: '={{$parameter["method"] ? $parameter["method"] + " - " + $parameter["apiSelection"] : $parameter["apiSelection"] || "Select an API"}}',

		// Node 描述文字
		description: 'Select and call APIs from SuperiorAPIs platform',

		// docs 網址
		documentationUrl:'https://superiorapis.cteam.com.tw/en-us/tutorials',

		// 默認值配置
		defaults: {
			name: 'SuperiorAPIs',
		},

		// 輸入端點（接收數據）
		inputs: ['main'],

		// 輸出端點（發送數據）
		outputs: ['main'],

		// ==================== 認證配置 ====================
		// SuperiorAPIs API 認證（選填 - 用於額外的 Headers）
		credentials: [
			{
				name: 'superiorAPIsApi',
				required: false,
			},
		],

		hints: [
			{
				// The hint message. You can use HTML.
				message:
					"This node has many input items. Consider enabling <b>Execute Once</b> in the node\'s settings.",
				// Choose from: info, warning, danger. The default is 'info'.
				// Changes the color. info (grey), warning (yellow), danger (red)
				type: 'info',
				// Choose from: inputPane, outputPane, ndv. By default n8n displays the hint in both the input and output panels.
				location: 'outputPane',
				// Choose from: always, beforeExecution, afterExecution. The default is 'always'
				whenToDisplay: 'beforeExecution',
				// Optional. An expression. If it resolves to true, n8n displays the message. Defaults to true.
				displayCondition: '={{ $parameter["operation"] === "select" && $input.all().length > 1 }}',
			},
		],

		// ==================== UI 參數配置 ====================
		properties: [
			// ==================== Token 輸入框（載入 API 列表用）====================
			{
				displayName: 'Token',
				name: 'token',
				type: 'string',
				typeOptions: { password: true },
				required: true,
				default: '',
				placeholder: 'Enter your token',
				description:
					'Token for accessing SuperiorAPIs platform. After entering the token, select: API → Method → Scenario (optional).',
			},

			// ==================== API 選擇器 ====================
			{
				displayName: 'API List Name or ID',
				name: 'apiSelection',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
				},
				typeOptions: {
					loadOptionsMethod: 'getApiList',
					loadOptionsDependsOn: ['token'],
				},
				default: '',
				description:
					'Step 1: Select an API from SuperiorAPIs platform. Click "View Specification Document" link in each option to see the API details. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},

			// ==================== HTTP Method 選擇器 ====================
			{
				displayName: 'HTTP Method Name or ID',
				name: 'method',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
				},
				typeOptions: {
					loadOptionsMethod: 'getMethods',
					loadOptionsDependsOn: ['apiSelection', 'token'],
				},
				default: '',
				description:
					'Step 2: Select HTTP method (available after selecting an API). Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},

			// ==================== Base URI 欄位 ====================
			{
				displayName: 'Base URI',
				name: 'baseUri',
				type: 'string',
				default: 'https://superiorapis-creator.cteam.com.tw',
				required: true,
				displayOptions: {
					hide: {
						method: [''],
					},
				},
				description:
					'Base URI for API requests. This will be used as the prefix for all API calls. You can modify this if you need to use a different server.',
			},

			// ==================== 情境選擇器 ====================
			{
				displayName: 'Scenario List Name or ID',
				name: 'scenario',
				type: 'options',
				description:
					'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
				noDataExpression: true,
				displayOptions: {
				},
				typeOptions: {
					loadOptionsMethod: 'getScenarioList',
					loadOptionsDependsOn: ['apiSelection', 'method', 'token'],
				},
				default: '',
			},

			// ==================== Body JSON (情境或不使用情境時顯示) ====================
			{
				displayName: 'Body JSON',
				name: 'bodyJson',
				type: 'json',
				default: '={{ $parameter["scenario"] }}',
				typeOptions: {
					alwaysOpenEditWindow: false,
					rows: 10,
				},
				displayOptions: {

					hide: {
						scenario: ['', 'no_use_scenario', 'error'],
					},
				},
				description:
					'Request body in JSON format. When using a scenario template, this shows the predefined parameters. When not using a template, this shows the default structure based on the API specification.',
			},

			// ==================== Body JSON 切換提示 ====================
			{
				displayName: '⚠️ Due to n8n parameter system limitations, when you switch between scenarios, the Body JSON field may display outdated content. To refresh the display:<br/><br/>Step 1: In the scenario list, select "Use Default Request Body".<br/>Step 2: Switch to the scenario you want to use.<br/><br/>Note: No matter what is displayed, the correct scenario JSON will always be used during execution.',
				name: 'bodyJsonNotice',
				type: 'notice',
				default:
					'Due to n8n parameter system limitations, when you switch between scenarios, the Body JSON field may display outdated content. To refresh the display:<br/><br/><strong>Method 1:</strong> Toggle between Expression and Fixed modes<br/><strong>Method 2:</strong> Click the field to edit, then click outside<br/><strong>Method 3:</strong> Close and reopen the node panel<br/><br/>Note: The correct JSON will always be used during execution regardless of the display.',
				displayOptions: {
					hide: {
						scenario: ['', 'no_use_scenario', 'error'],
					},
				},
			},

			// ==================== Parameters Resource Mapper (Query/Header - 無情境時顯示) ====================
			{
				displayName: 'API Parameters',
				name: 'parametersFields',
				type: 'resourceMapper',
				noDataExpression: true,
				default: {
					mappingMode: 'defineBelow',
					value: null,
				},
				typeOptions: {
					loadOptionsDependsOn: ['scenario', 'method', 'apiSelection'],
					resourceMapper: {
						resourceMapperMethod: 'getParametersFields',
						mode: 'add',
						fieldWords: {
							singular: 'parameter',
							plural: 'parameters',
						},
						addAllFields: true,
						multiKeyMatch: false,
						supportAutoMap: false,
						matchingFieldsLabels: {
							title: 'Parameters',
							description: 'Fill in the API parameters below',
						},
						valuesLabel: 'Parameter Values',
					},
				},
				displayOptions: {
					show: {
						scenario: ['no_use_scenario'],
					},
				},
				description: '&lt;strong&gt;📝 API Parameters:&lt;/strong&gt;• &lt;strong&gt;[Q]&lt;/strong&gt; = Query parameter (sent in URL)• &lt;strong&gt;[H]&lt;/strong&gt; = Header parameter (sent in request headers)• &lt;strong&gt;*&lt;/strong&gt; = Required parameter',
			},

			// ==================== Request Body Resource Mapper (POST/PUT/PATCH - 無情境時顯示) ====================
			{
				displayName: 'Request Body',
				name: 'bodyFields',
				type: 'resourceMapper',
				noDataExpression: true,
				default: {
					mappingMode: 'defineBelow',
					value: null,
				},
				typeOptions: {
					loadOptionsDependsOn: ['scenario', 'method', 'apiSelection'],
					resourceMapper: {
						resourceMapperMethod: 'getBodyFields',
						mode: 'add',
						fieldWords: {
							singular: 'field',
							plural: 'fields',
						},
						addAllFields: true,
						multiKeyMatch: false,
						supportAutoMap: false,
						matchingFieldsLabels: {
							title: 'Body Fields',
							description: 'Fill in the request body fields below',
						},
						valuesLabel: 'Request Body',
					},
				},
				displayOptions: {
					show: {
						scenario: ['no_use_scenario'],
						method: ['POST', 'PUT', 'PATCH'],
					},
				},
				description: '&lt;strong&gt;📝 Request Body Fields:&lt;/strong&gt;• All fields will be sent in the request body• &lt;strong&gt;*&lt;/strong&gt; = Required field',
			},

			// ==================== Query Parameters 區塊 ====================

			// UI: 開關按鈕 - 是否發送 Query Parameters
			{
				displayName: 'Send Query Parameters',
				name: 'sendQuery',
				type: 'boolean',
				default: false,
				description: 'Whether to send query parameters with the request',
			},

			// UI: 下拉選單 - 選擇 Query Parameters 輸入方式
			{
				displayName: 'Specify Query Parameters',
				name: 'specifyQuery',
				type: 'options',
				displayOptions: {
					show: {
						sendQuery: [true],
					},
				},
				options: [
					{
						name: 'Using Fields Below', // 選項 1：使用鍵值對
						value: 'keypair',
						description: 'Enter query parameters as key-value pairs',
					},
					{
						name: 'Using JSON', // 選項 2：使用 JSON
						value: 'json',
						description: 'Enter query parameters as a JSON object',
					},
				],
				default: 'keypair',
			},

			// UI: 鍵值對集合 - Query Parameters（方式 1）
			{
				displayName: 'Query Parameters',
				name: 'queryParameters',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				displayOptions: {
					show: {
						sendQuery: [true],
						specifyQuery: ['keypair'],
					},
				},
				default: {},
				options: [
					{
						name: 'parameter',
						displayName: 'Parameter',
						values: [
							{
								displayName: 'Name', // 參數名稱輸入框
								name: 'name',
								type: 'string',
								default: '',
								description: 'Parameter name',
							},
							{
								displayName: 'Value', // 參數值輸入框
								name: 'value',
								type: 'string',
								default: '',
								description: 'Parameter value (supports expressions)',
							},
						],
					},
				],
			},

			// UI: JSON 編輯器 - Query Parameters（方式 2）
			{
				displayName: 'Query Parameters',
				name: 'queryParametersJson',
				type: 'json',
				displayOptions: {
					show: {
						sendQuery: [true],
						specifyQuery: ['json'],
					},
				},
				default: '{}',
				description: 'Query parameters as JSON object (supports expressions)',
			},

			// ==================== Headers 區塊 ====================

			// UI: 開關按鈕 - 是否發送自定義 Headers
			{
				displayName: 'Send Headers',
				name: 'sendHeaders',
				type: 'boolean',
				default: false,
				description: 'Whether to send custom headers with the request',
			},

			// UI: 下拉選單 - 選擇 Headers 輸入方式
			{
				displayName: 'Specify Headers',
				name: 'specifyHeaders',
				type: 'options',
				displayOptions: {
					show: {
						sendHeaders: [true],
					},
				},
				options: [
					{
						name: 'Using Fields Below', // 選項 1：使用鍵值對
						value: 'keypair',
						description: 'Enter headers as key-value pairs',
					},
					{
						name: 'Using JSON', // 選項 2：使用 JSON
						value: 'json',
						description: 'Enter headers as a JSON object',
					},
				],
				default: 'keypair',
			},

			// UI: 鍵值對集合 - Headers（方式 1）
			{
				displayName: 'Headers',
				name: 'headers',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				displayOptions: {
					show: {
						sendHeaders: [true],
						specifyHeaders: ['keypair'],
					},
				},
				default: {},
				options: [
					{
						name: 'parameter',
						displayName: 'Header',
						values: [
							{
								displayName: 'Name', // Header 名稱輸入框（例如：Authorization）
								name: 'name',
								type: 'string',
								default: '',
								description: 'Header name',
							},
							{
								displayName: 'Value', // Header 值輸入框（例如：Bearer token123）
								name: 'value',
								type: 'string',
								default: '',
								description: 'Header value (supports expressions)',
							},
						],
					},
				],
			},

			// UI: JSON 編輯器 - Headers（方式 2）
			{
				displayName: 'Headers',
				name: 'headersJson',
				type: 'json',
				displayOptions: {
					show: {
						sendHeaders: [true],
						specifyHeaders: ['json'],
					},
				},
				default: '{}',
				description: 'Headers as JSON object (supports expressions)',
			},
		],
	};

	// ==================== Load Options 方法 ====================
	methods = {
		loadOptions: {
			// 載入 API 列表
			async getApiList(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const token = this.getNodeParameter('token') as string;

				if (!token) {
					return [];
				}

				try {
					// 使用快取方法
					const superiorAPIsNode = new SuperiorApis();
					const response = await superiorAPIsNode['getPluginListCached'](this, token);

					if (!response.plugins || !Array.isArray(response.plugins)) {
						return [];
					}

					return response.plugins.map((item: any) => {
						const plugin = item.plugin;

						// 從 description_for_human 中提取規範文件網址
						let specUrl = '';
						let interfaceId = '';

						if (plugin.description_for_human) {
							const specMatch = plugin.description_for_human.match(
								/規範文件:(https?:\/\/[^\s\n]+)/,
							);
							if (specMatch) {
								specUrl = specMatch[1];
								// 從 URL 中提取 interface_id（例如：3b52426bfe33）
								const idMatch = specUrl.match(/\/interface\/([a-zA-Z0-9]+)/);
								if (idMatch) {
									interfaceId = idMatch[1];
								}
							}
						}

						// 提取 version 資訊（嘗試從多個可能的位置）
						const version =
							plugin.version || plugin.interface?.version || plugin.interface?.info?.version || '';

						// 構建 description，包含可點擊的規範文件連結
						const baseDescription = plugin.description_for_human
							? plugin.description_for_human.split('\n')[0]
							: '';
						const description = specUrl
							? `${baseDescription}<br/>📖 <a href="${specUrl}" target="_blank">View Specification Document</a>`
							: baseDescription;

						// 將完整 plugin 資料編碼為 base64（包含所有必要資訊）
						const pluginData = {
							id: plugin.id,
							interfaceId,
							version,
							name: plugin.name_for_human,
							interface: plugin.interface,
						};
						const encodedData = Buffer.from(JSON.stringify(pluginData)).toString('base64');

						return {
							name: plugin.name_for_human,
							value: encodedData,
							description,
						};
					});
				} catch (error) {
					// 如果載入失敗，返回空列表
					return [];
				}
			},

			// 根據選擇的 API 載入可用的 HTTP Methods
			async getMethods(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const apiSelection = this.getNodeParameter('apiSelection') as string;

				if (!apiSelection) {
					return [];
				}

				try {
					// 從 base64 解碼 plugin 資料
					const pluginData = JSON.parse(Buffer.from(apiSelection, 'base64').toString());

					const paths = pluginData.interface.paths;
					const firstPath = Object.keys(paths)[0];
					const pathMethods = paths[firstPath];

					return Object.keys(pathMethods).map((method: string) => ({
						name: method.toUpperCase(),
						value: method.toUpperCase(),
						description: pathMethods[method].summary || `${method.toUpperCase()} request`,
					}));
				} catch (error) {
					return [];
				}
			},

			// 載入情境測試列表
			async getScenarioList(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const apiSelection = this.getNodeParameter('apiSelection') as string;
				const method = this.getNodeParameter('method', '') as string;

				if (!apiSelection || !method) {
					return [];
				}

				try {
					// 從 base64 解碼 plugin 資料
					const pluginData = JSON.parse(Buffer.from(apiSelection, 'base64').toString());
					const interfaceId = pluginData.interfaceId;
					const version = pluginData.version;

					// 生成預設的 request body JSON
					const paths = pluginData.interface.paths;
					const firstPath = Object.keys(paths)[0];
					const pathMethods = paths[firstPath];
					const methodData = pathMethods[method.toLowerCase()];

					// let defaultBodyJson = '{}';
					if (methodData && methodData.requestBody) {
						const content = methodData.requestBody.content;
						const jsonContent = content['application/json'];

						if (jsonContent && jsonContent.schema && jsonContent.schema.properties) {
							const properties = jsonContent.schema.properties;
							const defaultBody: any = {};

							Object.keys(properties).forEach((key) => {
								const prop = properties[key];
								// 根據類型設置預設值
								if (prop.type === 'string') {
									defaultBody[key] = prop.example || '';
								} else if (prop.type === 'number' || prop.type === 'integer') {
									defaultBody[key] = prop.example || 0;
								} else if (prop.type === 'boolean') {
									defaultBody[key] = prop.example !== undefined ? prop.example : false;
								} else if (prop.type === 'array') {
									defaultBody[key] = prop.example || [];
								} else if (prop.type === 'object') {
									defaultBody[key] = prop.example || {};
								} else {
									defaultBody[key] = prop.example !== undefined ? prop.example : null;
								}
							});

							// defaultBodyJson = JSON.stringify(defaultBody, null, 2);
						}
					}

					const response = await this.helpers.httpRequest({
						method: 'POST',
						url: 'https://superiorapis.cteam.com.tw/superiorapis_store/node/scenario_sample_list',
						headers: {
							token: this.getNodeParameter('token') as string,
							'Content-Type': 'application/json',
						},
						body: {
							method: method.toLowerCase(),
							interface_id: interfaceId,
							version: version,
							version_suffix: '',
						},
						json: true,
					});


					if (response.status === 1 && response.data?.list && response.data.list.length > 0) {
						// 批次載入所有情境的 request_content
						const scenariosWithContent = await Promise.all(
							response.data.list.map(async (scenario: any) => {
								try {
									const scenarioDetailResponse = await this.helpers.httpRequest({
										method: 'GET',
										url: `https://superiorapis.cteam.com.tw/superiorapis_store/node/scenario?scenario_id=${scenario.scenario_id}`,
										headers: {
											token: this.getNodeParameter('token') as string,
										},
										json: true,
									});

									if (
										scenarioDetailResponse.status === 1 &&
										scenarioDetailResponse.data?.request_content
									) {
										const requestContent = scenarioDetailResponse.data.request_content;

										return {
											name: scenario.scenario_name,
											value: JSON.stringify(requestContent, null, 4),
										};
									}
								} catch (error) {
									// 如果載入失敗，返回不含 description 的選項
								}

								return {
									name: scenario.scenario_name,
									value: scenario.scenario_id,
								};
							}),
						);

						// 在列表最前面加入「使用預設範本」選項
						return [
							{ name: 'Use Default Request Body', value: 'no_use_scenario' },
							...scenariosWithContent,
						];
					}

					// 如果 API 回應成功但沒有情境資料
					return [
						{ name: 'Use Default Request Body', value: 'no_use_scenario' },
						{
							name: `No scenario templates available for ${method.toUpperCase()} method`,
							value: 'no_scenario',
						},
					];
				} catch (error) {
					// 如果 API 呼叫失敗
					return [
						{ name: 'Use Default Request Body', value: 'no_use_scenario' },
						{
							name: `Failed to load scenario list. Please check network connection.`,
							value: 'error',
						},
					];
				}
			},
		},
		resourceMapping: {
			// 處理 Parameters (Query/Header)
			async getParametersFields(this: ILoadOptionsFunctions): Promise<ResourceMapperFields> {
				const scenario = this.getNodeParameter('scenario', '') as string;
				const method = this.getNodeParameter('method', '') as string;
				const apiSelection = this.getNodeParameter('apiSelection', '') as string;

				// 輔助函數：將 OpenAPI schema type 映射到 n8n field type
				const mapSchemaTypeToFieldType = (schemaType: string): ResourceMapperField['type'] => {
					const typeMap: Record<string, ResourceMapperField['type']> = {
						string: 'string',
						number: 'number',
						integer: 'number',
						boolean: 'boolean',
						array: 'array',
						object: 'object',
					};
					return typeMap[schemaType] || 'string';
				};

				// 只在 no_use_scenario 時才需要產生欄位
				if (scenario === 'no_use_scenario' && method && apiSelection) {
					try {
						const pluginData = JSON.parse(Buffer.from(apiSelection, 'base64').toString());
						const paths = pluginData.interface.paths;
						const firstPath = Object.keys(paths)[0];
						const pathMethods = paths[firstPath];
						const methodData = pathMethods[method.toLowerCase()];

						if (!methodData) {
							return { fields: [] };
						}

						const fields: ResourceMapperField[] = [];

						// 處理 parameters (query/header)
						if (methodData.parameters) {
							methodData.parameters.forEach((param: any) => {
								const inType = param.in === 'query' ? '[Q]' : '[H]';
								const description = param.description ? ` - ${param.description}` : '';
								fields.push({
									id: `${param.in}_${param.name}`,
									displayName: `${param.name}${param.required ? ' *' : ''} ${inType}${description}`,
									required: param.required || false,
									defaultMatch: true,
									display: true,
									type: mapSchemaTypeToFieldType(param.schema?.type || 'string'),
									canBeUsedToMatch: true,
								});
							});
						}

						// 排序：必填欄位在前
						fields.sort((a, b) => {
							if (a.required && !b.required) return -1;
							if (!a.required && b.required) return 1;
							return 0;
						});

						return { fields };
					} catch (error) {
						return { fields: [] };
					}
				}

				return { fields: [] };
			},

			// 處理 Request Body (POST/PUT/PATCH)
			async getBodyFields(this: ILoadOptionsFunctions): Promise<ResourceMapperFields> {
				const scenario = this.getNodeParameter('scenario', '') as string;
				const method = this.getNodeParameter('method', '') as string;
				const apiSelection = this.getNodeParameter('apiSelection', '') as string;

				// 輔助函數
				const mapSchemaTypeToFieldType = (schemaType: string): ResourceMapperField['type'] => {
					const typeMap: Record<string, ResourceMapperField['type']> = {
						'string': 'string',
						'number': 'number',
						'integer': 'number',
						'boolean': 'boolean',
						'array': 'array',
						'object': 'object',
					};
					return typeMap[schemaType] || 'string';
				};

				// 只在 no_use_scenario 且為 POST/PUT/PATCH 時產生 body 欄位
				if (scenario === 'no_use_scenario' && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase()) && apiSelection) {
					try {
						const pluginData = JSON.parse(Buffer.from(apiSelection, 'base64').toString());
						const paths = pluginData.interface.paths;
						const firstPath = Object.keys(paths)[0];
						const pathMethods = paths[firstPath];
						const methodData = pathMethods[method.toLowerCase()];

						if (!methodData || !methodData.requestBody) {
							return { fields: [] };
						}

						const fields: ResourceMapperField[] = [];
						const content = methodData.requestBody.content;
						const jsonContent = content['application/json'];

						if (jsonContent && jsonContent.schema && jsonContent.schema.properties) {
							const properties = jsonContent.schema.properties;
							const required = jsonContent.schema.required || [];

							Object.keys(properties).forEach((key) => {
								const prop = properties[key];
								const description = prop.description ? ` - ${prop.description}` : '';
								fields.push({
									id: `body_${key}`,
									displayName: `${key}${required.includes(key) ? ' *' : ''}${description}`,
									required: required.includes(key),
									defaultMatch: true,
									display: true,
									type: mapSchemaTypeToFieldType(prop.type || 'string'),
									canBeUsedToMatch: true,
									});
							});
						}

						// 排序：必填欄位在前
						fields.sort((a, b) => {
							if (a.required && !b.required) return -1;
							if (!a.required && b.required) return 1;
							return 0;
						});

						return { fields };
					} catch (error) {
						return { fields: [] };
					}
				}

				return { fields: [] };
			},
		},
	};

	/**
	 * ==================== 執行函數 ====================
	 * 當 Node 被觸發時執行的主要邏輯
	 *
	 * 流程：
	 * 1. 獲取選擇的 API 資訊
	 * 2. 提取 URL 和 HTTP 方法
	 * 3. 從 Credential 獲取 Authorization
	 * 4. 處理用戶自定義的 Headers 和 Body
	 * 5. 發送 HTTP 請求
	 * 6. 返回結果數據
	 */
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		// 獲取從前一個節點傳入的數據
		const items = this.getInputData();
		// 初始化返回數據數組
		const returnData: INodeExecutionData[] = [];

		// 遍歷每個輸入項（支持批次處理）
		for (let i = 0; i < items.length; i++) {
			try {
				// ==================== 獲取 API 資訊 ====================
				const token = this.getNodeParameter('token', i) as string;
				const apiSelection = this.getNodeParameter('apiSelection', i, '') as string;

				// 驗證必要欄位
				if (!token) {
					throw new NodeOperationError(this.getNode(), 'Token is required', { itemIndex: i });
				}
				if (!apiSelection) {
					throw new NodeOperationError(this.getNode(), 'Please select an API from the list', {
						itemIndex: i,
					});
				}

				// 從 base64 解碼 plugin 資料
				const pluginData = JSON.parse(Buffer.from(apiSelection, 'base64').toString());

				// 獲取使用者選擇的 HTTP Method
				let method = this.getNodeParameter('method', i, '') as string;

				// 獲取 Base URI
				const baseUri = this.getNodeParameter(
					'baseUri',
					i,
					'https://superiorapis-creator.cteam.com.tw',
				) as string;

				// 提取 path
				const paths = pluginData.interface.paths;
				const firstPath = Object.keys(paths)[0];
				const pathMethods = paths[firstPath];

				// 如果使用者沒有選擇 method，使用第一個可用的
				if (!method) {
					method = Object.keys(pathMethods)[0].toUpperCase();
				}

				// 組合完整 URL（使用自定義 Base URI）
				const url = `${baseUri}${firstPath}`;

				// ==================== 處理 Headers ====================
				// 優先使用 Token 欄位作為 API 請求的 token header
				let headers: IDataObject = {
					token: token,
				};

				// 取得 Credential (用於額外的 headers,但不覆蓋 token)
				const credentials = await this.getCredentials('superiorAPIsApi');

				// 合併 Credential 中的額外 headers (但保護 token 欄位不被覆蓋)
				if (credentials.headers) {
					const credHeaders = JSON.parse(credentials.headers as string);
					// 移除 credential headers 中的 token 欄位,避免覆蓋
					delete credHeaders.token;
					headers = { ...headers, ...credHeaders };
				}

				// 合併用戶自定義的 Headers (但保護 token 欄位不被覆蓋)
				const sendHeaders = this.getNodeParameter('sendHeaders', i, false) as boolean;
				if (sendHeaders) {
					const specifyHeaders = this.getNodeParameter('specifyHeaders', i) as string;

					if (specifyHeaders === 'keypair') {
						const params = this.getNodeParameter('headers', i, {}) as IDataObject;
						if (params.parameter && Array.isArray(params.parameter)) {
							const userHeaders = params.parameter.reduce((acc: IDataObject, p: IDataObject) => {
								acc[p.name as string] = p.value;
								return acc;
							}, {});
							// 移除用戶 headers 中的 token 欄位,避免覆蓋
							delete userHeaders.token;
							headers = { ...headers, ...userHeaders };
						}
					} else {
						const jsonString = this.getNodeParameter('headersJson', i) as string;
						const userHeaders = JSON.parse(jsonString);
						// 移除用戶 headers 中的 token 欄位,避免覆蓋
						delete userHeaders.token;
						headers = { ...headers, ...userHeaders };
					}
				}

				// ==================== 處理 Query Parameters ====================
				let queryParams: IDataObject = {};
				const sendQuery = this.getNodeParameter('sendQuery', i, false) as boolean;

				if (sendQuery) {
					const specifyQuery = this.getNodeParameter('specifyQuery', i) as string;

					if (specifyQuery === 'keypair') {
						const params = this.getNodeParameter('queryParameters', i, {}) as IDataObject;
						if (params.parameter && Array.isArray(params.parameter)) {
							queryParams = params.parameter.reduce((acc: IDataObject, p: IDataObject) => {
								acc[p.name as string] = p.value;
								return acc;
							}, {});
						}
					} else {
						const jsonString = this.getNodeParameter('queryParametersJson', i) as string;
						queryParams = JSON.parse(jsonString);
					}
				}

				// ==================== 處理 Request Body 和動態參數 ====================
				let body: IDataObject | string | undefined;
				const scenario = this.getNodeParameter('scenario', i, '') as string;

				// 從 parametersFields resourceMapper 讀取 query/header 參數
				const parametersFields = this.getNodeParameter(
					'parametersFields',
					i,
					null,
				) as IDataObject | null;
				if (parametersFields && parametersFields.value) {
					const params = parametersFields.value as IDataObject;
					Object.keys(params).forEach((key) => {
						const value = params[key];
						// query_ 前綴: 加到 query parameters
						if (key.startsWith('query_')) {
							const paramName = key.replace('query_', '');
							queryParams[paramName] = value;
						}
						// header_ 前綴: 加到 headers (但不覆蓋 token)
						else if (key.startsWith('header_')) {
							const paramName = key.replace('header_', '');
							if (paramName !== 'token') {
								headers[paramName] = value;
							}
						}
					});
				}

				// 從 bodyJson 讀取 request body（如果有選擇情境範本或不使用情境範本）
				if (scenario && scenario !== '' && scenario !== 'no_scenario' && scenario !== 'error') {
					try {
						const bodyJsonString = this.getNodeParameter('bodyJson', i, '') as string;
						if (bodyJsonString && bodyJsonString.trim() !== '' && bodyJsonString.trim() !== '{}') {
							body = JSON.parse(bodyJsonString);
						}
					} catch (error) {
						throw new NodeOperationError(
							this.getNode(),
							`Failed to parse body JSON: ${(error as Error).message}`,
							{ itemIndex: i },
						);
					}
				}

				// 自動偵測 API 要求的 Content-Type（只針對 POST/PUT/PATCH）
				if (['POST', 'PUT', 'PATCH'].includes(method)) {
					const methodData = pathMethods[method.toLowerCase()];
					if (methodData?.requestBody?.content) {
						const contentTypes = Object.keys(methodData.requestBody.content);
						const apiContentType = contentTypes[0]; // 使用 API 定義的第一個 content type

						// 根據 API 要求設定正確的 Content-Type Header
						if (!headers['Content-Type']) {
							if (apiContentType.includes('multipart/form-data')) {
								headers['Content-Type'] = 'multipart/form-data';
							} else if (apiContentType.includes('application/json')) {
								headers['Content-Type'] = 'application/json';
							} else if (apiContentType.includes('application/x-www-form-urlencoded')) {
								headers['Content-Type'] = 'application/x-www-form-urlencoded';
							} else {
								// 如果是其他類型，直接使用 API 定義的 content type
								headers['Content-Type'] = apiContentType;
							}
						}
					}
				}

				// ==================== 發送 HTTP 請求 ====================
				const options: IHttpRequestOptions = {
					method: method as IHttpRequestOptions['method'],
					url,
					qs: queryParams,
					headers,
					body,
					json: true,
					returnFullResponse: false,
				};
				const response = await this.helpers.httpRequest(options);

				// 將響應數據添加到返回數組
				returnData.push({
					json: typeof response === 'object' ? response : { data: response },
					pairedItem: { item: i },
				});
			} catch (error) {
				// ==================== 錯誤處理 ====================
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: (error as Error).message,
						},
						pairedItem: { item: i },
					});
					continue;
				}
				throw new NodeApiError(this.getNode(), error as JsonObject);
			}
		}

		// 返回所有處理結果
		return [returnData];
	}
}
