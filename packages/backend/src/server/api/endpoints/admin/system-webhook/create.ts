/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { SystemWebhookEntityService } from '@/core/entities/SystemWebhookEntityService.js';
import { systemWebhookEventTypes } from '@/models/SystemWebhook.js';
import { SystemWebhookService } from '@/core/SystemWebhookService.js';
import { HttpRequestService } from '@/core/HttpRequestService.js';
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
			id: 'b89fd7fe-2b6a-4a3c-9c8e-e5c3a4e1d7f2',
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
		private httpRequestService: HttpRequestService,
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
				await this.httpRequestService.validateUrlNotPrivate(ps.url);
			} catch {
				throw new ApiError(meta.errors.invalidUrl);
			}

			const result = await this.systemWebhookService.createSystemWebhook(
				{
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
