/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { WebhooksRepository } from '@/models/_.js';
import { webhookEventTypes } from '@/models/Webhook.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { DI } from '@/di-symbols.js';
import { HttpRequestService } from '@/core/HttpRequestService.js';
import { ApiError } from '../../../error.js';

export const meta = {
	tags: ['webhooks'],

	requireCredential: true,

	kind: 'write:account',

	errors: {
		noSuchWebhook: {
			message: 'No such webhook.',
			code: 'NO_SUCH_WEBHOOK',
			id: 'fb0fea69-da18-45b1-828d-bd4fd1612518',
		},
		invalidUrl: {
			message: 'The webhook URL is invalid or resolves to a private address.',
			code: 'INVALID_URL',
			id: 'a2c958c3-81a5-4d2f-a5b2-c8f92b6d3e7a',
		},
	},

} as const;

export const paramDef = {
	type: 'object',
	properties: {
		webhookId: { type: 'string', format: 'misskey:id' },
		name: { type: 'string', minLength: 1, maxLength: 100 },
		url: { type: 'string', minLength: 1, maxLength: 1024 },
		secret: { type: 'string', nullable: true, maxLength: 1024 },
		on: { type: 'array', items: {
			type: 'string', enum: webhookEventTypes,
		} },
		active: { type: 'boolean' },
	},
	required: ['webhookId'],
} as const;

// TODO: ロジックをサービスに切り出す

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.webhooksRepository)
		private webhooksRepository: WebhooksRepository,

		private globalEventService: GlobalEventService,
		private httpRequestService: HttpRequestService,
	) {
		super(meta, paramDef, async (ps, me) => {
			// Validate webhook URL if provided
			if (ps.url != null) {
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
			}

			const webhook = await this.webhooksRepository.findOneBy({
				id: ps.webhookId,
				userId: me.id,
			});

			if (webhook == null) {
				throw new ApiError(meta.errors.noSuchWebhook);
			}

			await this.webhooksRepository.update(webhook.id, {
				name: ps.name,
				url: ps.url,
				secret: ps.secret === null ? '' : ps.secret,
				on: ps.on,
				active: ps.active,
			});

			const updated = await this.webhooksRepository.findOneByOrFail({
				id: ps.webhookId,
			});

			this.globalEventService.publishInternalEvent('webhookUpdated', updated);
		});
	}
}
