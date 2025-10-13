import {
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class SuperiorAPIHttpApi implements ICredentialType {
	name = 'superiorAPIHttpApi';
	displayName = 'SuperiorAPIs (HTTP Streamable) API';
	documentationUrl = 'https://your-mcp-docs-url.com';
	icon = 'file:superiorapis.svg' as const;

	properties: INodeProperties[] = [
		{
			displayName: 'HTTP Stream URL',
			name: 'httpStreamUrl',
			type: 'string',
			default: 'http://192.168.1.195:9000/mcp/stream',
			required: true,
			description: 'URL of the HTTP stream endpoint for the MCP server',
		},
		{
			displayName: 'HTTP Connection Timeout',
			name: 'httpTimeout',
			type: 'number',
			default: 60000,
			required: false,
			description: 'Timeout for the HTTP stream connection in milliseconds. Default is 60 seconds.',
		},
		{
			displayName: 'Messages Post Endpoint',
			name: 'messagesPostEndpoint',
			type: 'string',
			default: '',
			description: 'Optional custom endpoint for posting messages (if different from HTTP stream URL)',
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
