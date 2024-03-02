import { Ai } from '@cloudflare/ai';

async function _imageGen(model, requestId, env, ai, results, type) {
	let failureMessage = null;
	const name = `${requestId}.${type}.png`;
	try {
		const imageBytes = await ai.run(model, { prompt: results[type].prompt });
		const { etag, size } = await env.GEN_IMAGES_BUCKET.put(name, imageBytes);
		console.log(`Object metadata for ${name}: ${JSON.stringify({ etag, size })}`);
		return name;
	} catch (e) {
		console.warn(`Image generation FAILED for "${type}": ${e} [req: ${requestId}]`);
		failureMessage = e.message;
		return null;
	} finally {
		const { success } = await env.DB.prepare('insert into GenImgResult values (?, ?, ?, ?, ?);')
			.bind(requestId, type, results[type].prompt, failureMessage ? null : name, failureMessage)
			.run();
		if (!success) {
			console.error(`DB insert into GenImgResult failed!`);
		}
	}
}

export default {
	async queue(batch, env) {
		const ai = new Ai(env.AI);
		for (let message of batch.messages) {
			const { requestId } = message.body;
			console.log(`Processing request ${requestId}...`);

			const reqObj = JSON.parse(await env.RequestsKVStore.get(requestId));

			const imageModel = await env.ConfigKVStore.get('textToImageModel');
			reqObj.meta.image_model_used = imageModel;
			reqObj.results.good.imageBucketId = await _imageGen(imageModel, requestId, env, ai, reqObj.results, 'good');
			reqObj.results.bad.imageBucketId = await _imageGen(imageModel, requestId, env, ai, reqObj.results, 'bad');

			reqObj.status = 'processed';
			await env.RequestsKVStore.put(requestId, JSON.stringify(reqObj));
			const { success, meta } = await env.DB.prepare('insert into ByInputUrl values (?, ?);').bind(reqObj.input.url, requestId).run();
			if (!success) {
				console.error(`DB insert failure: ${JSON.stringify(meta)}`);
			}
			console.log(`Done with request ${requestId}`);
		}
	},
};
