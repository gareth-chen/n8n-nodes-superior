import {
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class SuperiorAPISseApi implements ICredentialType {
	name = 'superiorAPISseApi';
	displayName = 'SuperiorAPIs (SSE) API';
	documentationUrl = 'https://your-mcp-docs-url.com';
	icon = 'file:superiorapis.svg' as const;

	properties: INodeProperties[] = [
		{
			displayName: 'SSE URL',
			name: 'sseUrl',
			type: 'string',
			default: 'http://192.168.1.195:9000/mcp/sse',
			required: true,
			description: 'URL of the SSE endpoint for the MCP server',
		},
		{
			displayName: 'SSE Connection Timeout',
			name: 'sseTimeout',
			type: 'number',
			default: 60000,
			required: false,
			description: 'Timeout for the SSE connection in milliseconds. Default is 60 seconds.',
		},
		{
			displayName: 'Messages Post Endpoint',
			name: 'messagesPostEndpoint',
			type: 'string',
			default: '',
			description: 'Optional custom endpoint for posting messages (if different from SSE URL)',
		},
		{
			displayName: 'Additional Headers',
			name: 'headers',
			type: 'string',
			default: '',
			description: 'Additional headers to send in the request in NAME=VALUE format, one per line (e.g., token=YOUR_TOKEN)',
		},
	];
}
