import {
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class SuperiorAPIsApi implements ICredentialType {
	name = 'superiorAPIsApi';
	displayName = 'SuperiorAPIs API';
	documentationUrl = 'https://superiorapis.cteam.com.tw';
	properties: INodeProperties[] = [
		{
			displayName: 'Additional Headers',
			name: 'headers',
			type: 'json',
			typeOptions: {
				alwaysOpenEditWindow: true,
			},
			default: '{}',
			placeholder: '{\n  "X-Custom-Header": "value"\n}',
			description: 'Additional custom headers (optional, as JSON object)',
		},
	];
}
