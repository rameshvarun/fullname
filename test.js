import {serial as test} from 'ava';
import mem from 'mem';
import mock from 'mock-require';
import importFresh from 'import-fresh';

let originalEnv;
let originalPlatform;
test.before(() => {
	originalEnv = Object.assign({}, process.env);
	originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
});

test.beforeEach(() => {
	delete process.env.GIT_AUTHOR_NAME;
	delete process.env.GIT_COMMITTER_NAME;
	delete process.env.HGUSER;
	delete process.env.C9_USER;

	Object.defineProperty(process, 'platform', originalPlatform);
	mock('rc', () => ({}));
});

test.after(() => {
	process.env = Object.assign({}, originalEnv);
	Object.defineProperty(process, 'platform', originalPlatform);
});

test('should get fullname from env var', async t => {
	const m = importFresh('.');
	mem.clear(m);

	process.env.GIT_AUTHOR_NAME = 'TEST-ENV-FULL-NAME';
	const fullname = await m();

	t.is(typeof fullname, 'string');
	t.is(fullname, 'TEST-ENV-FULL-NAME');
});

test('respects changed env vars', async t => {
	const m = importFresh('.');
	mem.clear(m);

	process.env.GIT_AUTHOR_NAME = 'NAME-1';
	const fullname1 = await m();
	process.env.GIT_AUTHOR_NAME = 'NAME-2';
	const fullname2 = await m();

	t.is(typeof fullname1, 'string');
	t.is(fullname1, 'NAME-1');
	t.is(typeof fullname2, 'string');
	t.is(fullname2, 'NAME-2');
	t.not(fullname1, fullname2);
});

test('should get value from init-author-name', async t => {
	mock('rc', () => ({
		'init-author-name': 'TEST-INIT-AUTHOR-FULL-NAME'
	}));

	const m = importFresh('.');
	mem.clear(m);

	const fullname = await m();
	t.is(typeof fullname, 'string');
	t.is(fullname, 'TEST-INIT-AUTHOR-FULL-NAME');
});

test('should get value from passwdUser for darwin platform', async t => {
	// Redefine process.platform
	Object.defineProperty(process, 'platform', {
		value: 'darwin'
	});

	mock('passwd-user', () => Promise.resolve({
		fullname: 'TEST-PASSWD-FULL-NAME'
	}));

	const m = importFresh('.');
	mem.clear(m);

	const fullname = await m();
	t.is(typeof fullname, 'string');
	t.is(fullname, 'TEST-PASSWD-FULL-NAME');
});

test('should get value from osascript for darwin platform if passwdUser returns empty username', async t => {
	// Redefine process.platform
	Object.defineProperty(process, 'platform', {
		value: 'darwin'
	});

	mock('execa', {
		stdout: () => Promise.resolve('TEST-OSASCRIPT-FULL-NAME')
	});

	mock('passwd-user', () => Promise.resolve());

	const m = importFresh('.');
	mem.clear(m);

	const fullname = await m();
	t.is(typeof fullname, 'string');
	t.is(fullname, 'TEST-OSASCRIPT-FULL-NAME');
});

test('should get value from osascript for darwin platform if passwdUser rejects', async t => {
	// Redefine process.platform
	Object.defineProperty(process, 'platform', {
		value: 'darwin'
	});

	mock('execa', {
		stdout: () => Promise.resolve('TEST-OSASCRIPT-FULL-NAME')
	});

	mock('passwd-user', () => Promise.reject());

	const m = importFresh('.');
	mem.clear(m);

	const fullname = await m();
	t.is(typeof fullname, 'string');
	t.is(fullname, 'TEST-OSASCRIPT-FULL-NAME');
});

test('should get value from git global user for win32 platform', async t => {
	// Redefine process.platform
	Object.defineProperty(process, 'platform', {
		value: 'win32'
	});

	mock('execa', {
		stdout: first => {
			if (first === 'git') {
				return Promise.resolve('TEST-GIT-GLOBAL-FULL-NAME');
			}

			return Promise.resolve('');
		}
	});

	mock('passwd-user', () => Promise.reject());

	const m = importFresh('.');
	mem.clear(m);

	const fullname = await m();
	t.is(typeof fullname, 'string');
	t.is(fullname, 'TEST-GIT-GLOBAL-FULL-NAME');
});

test('should get value from wmic for win32 platform if git global returns empty username', async t => {
	mock('execa', {
		stdout: first => {
			if (first === 'wmic') {
				return Promise.resolve('TEST-WMIC-FULL-NAME');
			}

			return Promise.resolve('');
		}
	});

	// Redefine process.platform
	Object.defineProperty(process, 'platform', {
		value: 'win32'
	});

	const m = importFresh('.');
	mem.clear(m);

	const fullname = await m();
	t.is(typeof fullname, 'string');
	t.is(fullname, 'TEST-WMIC-FULL-NAME');
});

test('should get value from wmic for win32 platform if git global rejects', async t => {
	mock('execa', {
		stdout: first => {
			if (first === 'wmic') {
				return Promise.resolve('TEST-WMIC-FULL-NAME');
			}

			return Promise.reject(new Error('FAILED'));
		}
	});

	// Redefine process.platform
	Object.defineProperty(process, 'platform', {
		value: 'win32'
	});

	const m = importFresh('.');
	mem.clear(m);

	const fullname = await m();
	t.is(typeof fullname, 'string');
	t.is(fullname, 'TEST-WMIC-FULL-NAME');
});

test('should get value from passwdUser for other platform and both other checks fail', async t => {
	mock('passwd-user', () => Promise.resolve({
		fullname: 'TEST-PASSWD-FULL-NAME'
	}));

	mock('execa', {
		stdout: () => Promise.reject(new Error('FAILED')),
		// Getent result
		shell: () => Promise.reject(new Error('FAILED'))
	});

	// Redefine process.platform
	Object.defineProperty(process, 'platform', {
		value: 'other'
	});

	const m = importFresh('.');
	mem.clear(m);

	const fullname = await m();
	t.is(typeof fullname, 'string');
	t.is(fullname, 'TEST-PASSWD-FULL-NAME');
});

test('should get value from getent for other platform and both other checks fail', async t => {
	mock('execa', {
		stdout: () => Promise.reject(new Error('FAILED')),
		// Getent result
		shell: () => Promise.resolve({
			stdout: '1:2:3:4:TEST-GETENT-FULL-NAME'
		})
	});

	mock('passwd-user', () => Promise.reject(new Error('FAILED')));

	// Redefine process.platform
	Object.defineProperty(process, 'platform', {
		value: 'other'
	});

	const m = importFresh('.');
	mem.clear(m);

	const fullname = await m();
	t.is(typeof fullname, 'string');
	t.is(fullname, 'TEST-GETENT-FULL-NAME');
});

test('should get value from git for other platform and both other checks fail', async t => {
	mock('execa', {
		stdout: () => Promise.resolve('TEST-GIT-FULL-NAME'),
		// Getent result
		shell: () => Promise.reject(new Error('FAILED'))
	});

	mock('passwd-user', () => Promise.reject(new Error('FAILED')));

	// Redefine process.platform
	Object.defineProperty(process, 'platform', {
		value: 'other'
	});

	const m = importFresh('.');
	mem.clear(m);

	const fullname = await m();
	t.is(typeof fullname, 'string');
	t.is(fullname, 'TEST-GIT-FULL-NAME');
});

test('should get value from passwdUser for other platform and both other checks return empty string', async t => {
	mock('passwd-user', () => Promise.resolve({
		fullname: 'TEST-PASSWD-FULL-NAME'
	}));

	mock('execa', {
		// CheckGit result
		stdout: () => Promise.resolve(''),
		// Getent result
		shell: () => Promise.resolve('')
	});

	// Redefine process.platform
	Object.defineProperty(process, 'platform', {
		value: 'other'
	});

	const m = importFresh('.');
	mem.clear(m);

	const fullname = await m();
	t.is(typeof fullname, 'string');
	t.is(fullname, 'TEST-PASSWD-FULL-NAME');
});

test('should get value from getent for other platform and both other checks return empty string', async t => {
	mock('execa', {
		// CheckGit result
		stdout: () => Promise.resolve(''),
		// Getent result
		shell: () => Promise.resolve({
			stdout: '1:2:3:4:TEST-GETENT-FULL-NAME'
		})
	});
	mock('passwd-user', () => Promise.resolve(''));

	// Redefine process.platform
	Object.defineProperty(process, 'platform', {
		value: 'other'
	});

	const m = importFresh('.');
	mem.clear(m);

	const fullname = await m();
	t.is(typeof fullname, 'string');
	t.is(fullname, 'TEST-GETENT-FULL-NAME');
});

test('should get value from git for other platform and both other checks return empty string', async t => {
	mock('execa', {
		// CheckGit result
		stdout: () => Promise.resolve('TEST-GIT-FULL-NAME'),
		// Getent result
		shell: () => Promise.resolve('')
	});

	mock('passwd-user', () => Promise.resolve(''));

	// Redefine process.platform
	Object.defineProperty(process, 'platform', {
		value: 'other'
	});

	const m = importFresh('.');
	mem.clear(m);

	const fullname = await m();
	t.is(typeof fullname, 'string');
	t.is(fullname, 'TEST-GIT-FULL-NAME');
});
