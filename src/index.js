import { Ai } from '@cloudflare/ai';

async function _imageGen(requestId, env, ai, results, type) {
	try {
		const imageBytes = await ai.run('@cf/stabilityai/stable-diffusion-xl-base-1.0', { prompt: results[type].prompt });
		const name = `${requestId}.${type}.png`;
		const { etag, size } = await env.GEN_IMAGES_BUCKET.put(name, imageBytes);
		console.log(`Object metadata for ${name}: ${JSON.stringify({ etag, size })}`);
		return name;
	} catch (e) {
		console.log(`_imageGen failed for "${type}": ${e} [req: ${requestId}]`);
		return null;
	}
}

export default {
	async queue(batch, env) {
		const ai = new Ai(env.AI);
		for (let message of batch.messages) {
			const { requestId } = message.body;
			console.log(`Processing request ${requestId}...`);

			const reqObj = JSON.parse(await env.RequestsKVStore.get(requestId));

			reqObj.results.good.imageBucketId = await _imageGen(requestId, env, ai, reqObj.results, 'good');
			reqObj.results.bad.imageBucketId = await _imageGen(requestId, env, ai, reqObj.results, 'bad');

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