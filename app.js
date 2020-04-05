const fs = require('fs');
const path = require('path');
const Twii = require('twii');
const Fanfou = require('fanfou-sdk');
const Conf = require('conf');
const download = require('download');
const schedule = require('node-schedule');
const {ttConfig, ffConfig, user} = require('./config');

const tt = new Twii(ttConfig);
const ff = new Fanfou(ffConfig);
const config = new Conf();
const downpath = path.join(__dirname, './downloads');

const getTimelineMedia = async () => {
	const response = await tt.get('/statuses/user_timeline', {include_rts: false});
	const {body: tl} = response;

	const mediaStatuses = tl
		.filter(t => t.user.name === user.name && t.entities.media && /Nintendo Switch Share/.test(t.source))
		.map(t => ({
			status: t.text.replace(/ https:\/\/t.co\/.+/, ''),
			media: t.entities.media.map(m => m.media_url_https)
		}));

	const downloadList = [];
	mediaStatuses.forEach(s => {
		s.media.forEach(m => {
			const fileExist = Boolean(config.get(path.basename(m, '.jpg')));
			if (!fileExist) {
				downloadList.push({photo: m, status: s.status});
			}
		});
	});
	console.log('Download list:', downloadList);

	const succeedList = [];
	const downloadTask = downloadList.map(item => download(item.photo, downpath)
		.then(() => {
			const filename = path.basename(item.photo, '.jpg');
			config.set(filename, item.photo);
			succeedList.push({status: item.status, filename});
			console.log('Download:', item.photo);
		}));

	await Promise.all(downloadTask);
	console.log(succeedList);

	succeedList.reverse();

	succeedList.forEach(async item => {
		const photoPath = path.join(downpath, `./${item.filename}.jpg`);
		try {
			await ff.post('/photos/upload', {status: item.status, photo: fs.createReadStream(photoPath)});
			console.log('Upload:', item.status);
		} catch (error) {
			console.log('Upload error:', error.message);
		}
	});
};

getTimelineMedia();
schedule.scheduleJob('*/5 * * * *', () => {
	try {
		getTimelineMedia();
	} catch (error) {
		console.log('Schedule error:', error.message);
	}
});
