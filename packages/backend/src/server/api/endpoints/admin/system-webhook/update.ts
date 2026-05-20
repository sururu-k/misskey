/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import dns from 'node:dns';
import { Injectable } from '@nestjs/common';
import ipaddr from 'ipaddr.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { SystemWebhookEntityService } from '@/core/entities/SystemWebhookEntityService.js';
import { systemWebhookEventTypes } from '@/models/SystemWebhook.js';
import { SystemWebhookService } from '@/core/SystemWebhookService.js';
import { ApiError } from '@/server/api/error.js';

export const meta = {
	tags: ['admin', 'system-webhook'],

	requireCredential: true,
	requireModerator: true,
	secure: true,
	kind: 'write:admin:system-webhook',

	errors: {
		invalidUrl: {
			message: 'The webhook URL is invalid or resolves to a private address.',
			code: 'INVALID_URL',
			id: 'c7a3e2d1-4f5b-4e8a-9d6c-f3a1b2c4d5e6',
		},
	},

	res: {
		type: 'object',
		ref: 'SystemWebhook',
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		id: {
			type: 'string',
			format: 'misskey:id',
		},
		isActive: {
			type: 'boolean',
		},
		name: {
			type: 'string',
			minLength: 1,
			maxLength: 255,
		},
		on: {
			type: 'array',
			items: {
				type: 'string',
				enum: systemWebhookEventTypes,
			},
		},
		url: {
			type: 'string',
			minLength: 1,
			maxLength: 1024,
		},
		secret: {
			type: 'string',
			maxLength: 1024,
			default: '',
		},
	},
	required: [
		'id',
		'isActive',
		'name',
		'on',
		'url',
	],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		private systemWebhookService: SystemWebhookService,
		private systemWebhookEntityService: SystemWebhookEntityService,
	) {
		super(meta, paramDef, async (ps, me) => {
			let parsedUrl: URL;
			try {
				parsedUrl = new URL(ps.url);
			} catch {
				throw new ApiError(meta.errors.invalidUrl);
			}
			if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
				throw new ApiError(meta.errors.invalidUrl);
			}
			try {
				const hostname = parsedUrl.hostname;
				if (ipaddr.isValid(hostname)) {
					const addr = ipaddr.parse(hostname);
					if (addr.range() !== 'unicast') {
						throw new Error('private IP');
					}
				} else {
					const { address } = await dns.promises.lookup(hostname);
					const addr = ipaddr.parse(address);
					if (addr.range() !== 'unicast') {
						throw new Error('private IP');
					}
				}
			} catch {
				throw new ApiError(meta.errors.invalidUrl);
			}

			const result = await this.systemWebhookService.updateSystemWebhook(
				{
					id: ps.id,
					isActive: ps.isActive,
					name: ps.name,
					on: ps.on,
					url: ps.url,
					secret: ps.secret,
				},
				me,
			);

			return this.systemWebhookEntityService.pack(result);
		});
	}
}
