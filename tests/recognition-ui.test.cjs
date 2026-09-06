// Render real result JSX using minimal native host shims. No Firebase or paid API.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function load(relative, extra = {}, platform = 'web') {
  const filename = path.resolve(__dirname, '..', relative);
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    allowJs: true,
  }, fileName: filename.replace(/\.js$/, '.jsx') }).outputText;
  const exports = {};
  const native = { StyleSheet: { create: x => x }, Alert: { alert: () => {} },
    Pressable: ({ children }) => React.createElement('button', null, children),
    View: ({ children }) => React.createElement('div', null, children),
    Text: ({ children }) => React.createElement('span', null, children), Platform: { OS: platform } };
  vm.runInNewContext(source, { exports, require: name => name === 'react-native' ? native :
      Object.hasOwn(extra, name) ? extra[name] : require(name),
    process, FormData: extra.FormData || FormData, AbortController, setTimeout, clearTimeout, fetch: extra.fetch,
    console, TypeError, Error }, { filename });
  return exports;
}

const Result = load('components/MedicineRecognitionResult.js', {
  '../services/languageService': { getLanguageOption: () => ({ nativeLabel: 'English' }) },
  '../services/speechService': { speakMedicineResult: async () => {}, stopMedicineSpeech: async () => {} },
  '../hooks/use-themed-styles': { useThemedStyles: styles => styles },
  '../contexts/LanguageContext': { useLanguage: () => ({ t: key => ({
    medicineIdentified: 'Medicine identified', activeIngredient: 'Active ingredient', strength: 'Strength',
    commonUsage: 'Common usage', generalDosage: 'General dosage information', adults: 'Adults', children: 'Children',
    dosageDetailWarning: 'This is general dosage information. For detailed dosage, read the instructions on the box.', exactNotConfirmed: 'Unable to confirm exact medicine',
    possibleMedicine: 'Possible medicine', possibleStrength: 'Possible strength', dosageUnverified: 'Dosage cannot be verified',
    noResult: 'No result found', speakResult: 'Speak result', firstResultRetained: 'First result retained',
    confirmQuestion: 'Confirm exact product?', secondPhotoHelp: 'Take second photo', scanPackage: 'Scan Back Foil or Box',
    finishWithoutPhoto: 'Finish Without Another Photo', pharmacistFinish: 'Show a pharmacist',
    safetyDisclaimer: 'Verify with a pharmacist.', usageUnavailable: 'Usage unavailable',
    adultDoseHelp: 'Ask pharmacist', childDoseHelp: 'Ask pharmacist', unresolvedTwoPhotos: 'Not confirmed',
    unresolvedPhoto: 'Not enough information', possibleDosage: 'Possible general dosage — verify first',
    possibleDosageWarning: 'Do not use until confirmed.',
  }[key] || key) }) },
}).default;
const medicine = { id: 1, product_name: 'SYNTHETIC TEST PRODUCT 10 mg tablet',
  active_ingredient: 'TEST INGREDIENT[10mg]', registration_number: 'TEST-ONLY', source: 'NPRA test fixture' };
function result(status) {
  return { status, message: 'Test message', processing_time_ms: 100,
    disclaimer: 'Verify with a pharmacist.', detections: [{ id: 1, status, class_name: 'pill',
      detection_confidence: .9, bbox: [0, 0, 100, 100],
      visual_evidence: { imprint: 'TEST', dosage: null },
      match: { confidence_level: 'LOW', score: 25, score_description: 'Heuristic, not a medical probability.',
        medicine: status === 'MATCH_FOUND' ? medicine : null,
        candidates: [{ medicine, score: 25, evidence_matches: ['Visible product text'], conflicts: [] }] },
      preliminary_summary: status === 'MATCH_FOUND' ? null : {
        possible_name: 'Test Ingredient', common_uses: ['General example use'],
      } }] };
}

for (const status of ['MATCH_FOUND', 'AMBIGUOUS', 'UNKNOWN', 'LOW_CONFIDENCE', 'IMAGE_TOO_POOR', 'PROCESSING_ERROR']) {
  test(`renders concise ${status} result without internal evidence or candidate lists`, () => {
    const html = renderToStaticMarkup(React.createElement(Result, { result: result(status) }));
    assert.match(html, /Verify with a pharmacist/);
    assert.doesNotMatch(html, /Visually observed|detector confidence|Identification evidence|Possible candidates|Registration:/);
    if (status === 'MATCH_FOUND') {
      assert.match(html, /Medicine identified/);
      assert.match(html, /Strength:.*10 mg/);
    } else {
      assert.match(html, /Possible medicine/);
      assert.match(html, /Dosage cannot be verified/);
      assert.match(html, /Scan Back Foil or Box/);
    }
  });
}

test('renders a short no-result response', () => {
  const empty = { ...result('NO_MEDICINE_DETECTED'), detections: [] };
  const html = renderToStaticMarkup(React.createElement(Result, { result: empty }));
  assert.match(html, /No result found/);
  assert.match(html, /Scan Back Foil or Box/);
  assert.match(html, /Speak result/);
  assert.ok(html.indexOf('Speak result') < html.indexOf('No result found'));
});

test('does not expose detector fallback details', () => {
  const fallback = result('AMBIGUOUS');
  fallback.detections[0].detection_source = 'full_image_fallback';
  const html = renderToStaticMarkup(React.createElement(Result, { result: fallback }));
  assert.doesNotMatch(html, /YOLO|full image|detector confidence/);
});

test('renders an AI fallback as a possible medicine without technical details', () => {
  const suggested = result('UNKNOWN');
  suggested.detections[0].preliminary_summary = null;
  suggested.detections[0].ai_suggestion = { product_name: 'POSSIBLE PRODUCT',
    active_ingredient: 'POSSIBLE INGREDIENT', strength: '160 mg', dosage_form: 'tablet',
    common_uses: ['General example use'], confidence: 'LOW', basis: 'Visible marking' };
  suggested.detections[0].ai_suggestion_message = 'Not found in NPRA.';
  const html = renderToStaticMarkup(React.createElement(Result, { result: suggested }));
  assert.match(html, /Possible medicine/);
  assert.doesNotMatch(html, /AI-suggested identity|Not found in NPRA|Suggestion confidence|Basis:/);
  assert.match(html, /General example use/);
  assert.match(html, /Possible strength.*160 mg/);
  assert.match(html, /Dosage cannot be verified/);
});

test('renders possible dosage only when the backend approved clear packaging evidence', () => {
  const suggested = result('UNKNOWN');
  suggested.detections[0].preliminary_summary = null;
  suggested.detections[0].ai_suggestion = { product_name: 'UNLISTED TEST 10 mg tablet',
    active_ingredient: 'TEST INGREDIENT', strength: '10 mg', dosage_form: 'tablet',
    common_uses: ['General example use'], confidence: 'LOW', basis: 'Printed packaging' };
  suggested.detections[0].possible_guidance = {
    common_uses: ['General example use'], adult_general_dosage: 'General adult label information.',
    child_general_dosage: 'Ask a doctor.', dosage_notes: ['Verify the leaflet.'],
  };
  const html = renderToStaticMarkup(React.createElement(Result, { result: suggested }));
  assert.match(html, /Possible general dosage/);
  assert.match(html, /General adult label information/);
  assert.match(html, /Do not use until confirmed/);
});

test('after a second photo, an unresolved result is short and offers no candidate list', () => {
  const unresolved = { ...result('AMBIGUOUS'), refinement_used: true };
  const html = renderToStaticMarkup(React.createElement(Result, { result: unresolved }));
  assert.match(html, /Unable to confirm exact medicine/);
  assert.doesNotMatch(html, /Scan Back Foil or Box|Possible candidates|SYNTHETIC TEST PRODUCT/);
});

test('transport uploads multipart and never identifies from filename', async () => {
  let called = false;
  const expected = { status: 'UNKNOWN', detections: [] };
  process.env.EXPO_PUBLIC_RECOGNITION_API_URL = 'http://localhost:8000';
  const service = load('services/aiIdentificationService.js', {
    '../firebaseConfig': { db: {} }, 'firebase/firestore': { collection: () => ({}) },
    'expo-file-system': { File: class {} },
    'expo-image-manipulator': { ImageManipulator: {}, SaveFormat: { JPEG: 'jpeg' } },
    fetch: async (url, options) => {
      assert.equal(url, 'http://localhost:8000/api/recognize');
      assert.equal(options.method, 'POST');
      assert.ok(options.body instanceof FormData);
      assert.equal(options.headers, undefined);
      called = true;
      return { ok: true, json: async () => expected };
    },
  });
  const actual = await service.identifyMedicineFromImage({ uri: 'blob:test', fileName: 'panadol.jpg',
    mimeType: 'image/jpeg', file: new Blob(['test'], { type: 'image/jpeg' }) });
  assert.equal(actual, expected);
  assert.ok(called);
});

test('transport sends first-photo evidence only when refining with packaging', async () => {
  const expected = { status: 'UNKNOWN', detections: [] };
  process.env.EXPO_PUBLIC_RECOGNITION_API_URL = 'http://localhost:8000';
  const previous = { imprint: 'FENO', visible_text: ['FENO'] };
  const service = load('services/aiIdentificationService.js', {
    '../firebaseConfig': { db: {} }, 'firebase/firestore': { collection: () => ({}) },
    'expo-file-system': { File: class {} },
    'expo-image-manipulator': { ImageManipulator: {}, SaveFormat: { JPEG: 'jpeg' } },
    fetch: async (_url, options) => {
      assert.equal(options.body.get('language'), 'en');
      assert.deepEqual(JSON.parse(options.body.get('previous_evidence')), previous);
      return { ok: true, json: async () => expected };
    },
  });
  await service.identifyMedicineFromImage({ uri: 'blob:test', fileName: 'package.jpg',
    mimeType: 'image/jpeg', file: new Blob(['test'], { type: 'image/jpeg' }) }, 'en', previous);
});

test('application translations provide English, Malay, and Chinese UI text', () => {
  const i18n = load('services/i18n.js');
  assert.equal(i18n.translate('en', 'settings'), 'Settings');
  assert.equal(i18n.translate('ms', 'settings'), 'Tetapan');
  assert.equal(i18n.translate('zh', 'settings'), '设置');
  assert.equal(i18n.translate('en', 'loginGreeting', { username: 'Joher' }),
    'Login Successful. Hi, Joher');
  assert.equal(i18n.translate('ms', 'loginGreeting', { username: 'Joher' }),
    'Log masuk berjaya. Hai, Joher');
  assert.equal(i18n.translate('zh', 'milestoneBody', { days: 7 }),
    '您已连续 7 天按时服用每一剂。请继续保持。');
});

test('first launch language follows supported device locales', () => {
  const service = load('services/languageService.js', {
    '@react-native-async-storage/async-storage': { getItem: async () => null, setItem: async () => {} },
    'firebase/firestore': { doc: () => ({}), getDoc: async () => ({ exists: () => false }), setDoc: async () => {} },
    '../firebaseConfig': { db: {} },
  });
  assert.equal(service.getSystemLanguage('ms-MY'), 'ms');
  assert.equal(service.getSystemLanguage('zh-Hans-MY'), 'zh');
  assert.equal(service.getSystemLanguage('en-MY'), 'en');
  assert.equal(service.getSystemLanguage('fr-FR'), 'en');
});

test('dark appearance transforms page, card, text, and border colors', () => {
  const themed = load('hooks/use-themed-styles.js', {
    '../contexts/ThemeContext': { useAppTheme: () => ({ dark: true }) },
  });
  const result = themed.themeStyleObject({ page: { backgroundColor: '#f8fafc', color: '#0f172a', borderColor: '#e2e8f0' } }, true);
  assert.equal(result.page.backgroundColor, '#0f172a');
  assert.equal(result.page.color, '#f8fafc');
  assert.equal(result.page.borderColor, '#334155');
});

test('appearance preference is saved to the Firebase user and device', async () => {
  let savedProfile;
  let cached;
  const service = load('services/themeService.js', {
    '@react-native-async-storage/async-storage': {
      getItem: async () => null,
      multiSet: async entries => { cached = entries; },
      setItem: async () => {},
    },
    'react-native': { Appearance: { getColorScheme: () => 'light' } },
    'firebase/firestore': {
      doc: (_db, collection, uid) => ({ collection, uid }),
      getDoc: async () => ({ exists: () => false }),
      setDoc: async (reference, data, options) => { savedProfile = { reference, data, options }; },
    },
    '../firebaseConfig': { db: {} },
  });
  await service.savePreferredTheme('user-1', 'dark');
  assert.equal(savedProfile.data.preferred_theme, 'dark');
  assert.equal(savedProfile.options.merge, true);
  assert.match(JSON.stringify(cached), /preferred_theme\/user-1/);
  assert.match(JSON.stringify(cached), /app_theme/);
});

test('chatbot transport sends the selected application language', async () => {
  process.env.EXPO_PUBLIC_MEDISNAP_API_URL = 'http://localhost:3001';
  const service = load('services/chatbotService.js', {
    '../firebaseConfig': { db: {} },
    'firebase/firestore': { collection: () => ({}) },
    fetch: async (_url, options) => {
      const body = JSON.parse(options.body);
      assert.equal(body.language, 'zh');
      assert.equal(body.question, 'What is this medicine?');
      return { ok: true, json: async () => ({ reply: '测试回复' }) };
    },
  });
  const reply = await service.generateChatbotReply('What is this medicine?', [], 'zh');
  assert.equal(reply, '测试回复');
});

test('native transport appends an Expo File instead of the rejected URI object', async () => {
  const expected = { status: 'UNKNOWN', detections: [] };
  process.env.EXPO_PUBLIC_RECOGNITION_API_URL = 'http://localhost:8001';
  class ExpoFile {
    constructor(uri) { this.uri = uri; this.name = 'medicine.jpg'; this.type = 'image/jpeg'; }
    async bytes() { return new Uint8Array([1]); }
  }
  class NativeFormData {
    append(field, value) { this.field = field; this.value = value; }
  }
  const service = load('services/aiIdentificationService.js', {
    '../firebaseConfig': { db: {} }, 'firebase/firestore': { collection: () => ({}) },
    'expo-file-system': { File: ExpoFile }, FormData: NativeFormData,
    'expo-image-manipulator': {
      SaveFormat: { JPEG: 'jpeg' },
      ImageManipulator: { manipulate: (uri) => {
        assert.equal(uri, 'file:///cache/medicine.jpg');
        return {
          resize: () => assert.fail('small test image should not be resized'),
          renderAsync: async () => ({ saveAsync: async (options) => {
            assert.equal(options.format, 'jpeg');
            return { uri: 'file:///cache/normalized.jpeg' };
          } }),
        };
      } },
    },
    fetch: async (url, options) => {
      assert.equal(url, 'http://localhost:8001/api/recognize');
      assert.equal(options.body.field, 'image');
      assert.ok(options.body.value instanceof ExpoFile);
      assert.equal(options.body.value.uri, 'file:///cache/normalized.jpeg');
      return { ok: true, json: async () => expected };
    },
  }, 'android');
  const actual = await service.identifyMedicineFromImage({
    uri: 'file:///cache/medicine.jpg', fileName: 'medicine.jpg', mimeType: 'image/jpeg', width: 800, height: 600,
  });
  assert.equal(actual, expected);
});

test('spoken unverified result includes identity, uses, and withholds dosage', () => {
  const spoken = load('services/speechService.js', {
    'expo-speech': { stop: async () => {}, speak: () => {}, maxSpeechInputLength: 4000 },
    './languageService': { getLanguageOption: code => ({ code, speechCode: 'ms-MY' }) },
  });
  const recognized = result('UNKNOWN');
  recognized.detections[0].match.medicine = null;
  recognized.detections[0].preliminary_summary = {
    possible_name: 'Fenofibrate', common_uses: ['Kegunaan umum'],
  };
  const text = spoken.buildMedicineSpeech(recognized, 'ms');
  assert.match(text, /Fenofibrate/);
  assert.match(text, /Kegunaan umum/);
  assert.match(text, /Maklumat dos tidak tersedia kerana identiti ubat belum disahkan/);
  assert.doesNotMatch(text, /ambil \d|take \d/i);
});

test('renders and speaks general dosage only for a verified product', () => {
  const verified = result('MATCH_FOUND');
  verified.detections[0].general_guidance = {
    common_uses: ['General example use'], adult_general_dosage: 'General adult example.',
    child_general_dosage: 'Doctor must determine the child dose.',
    dosage_notes: ['Read the product leaflet.'],
  };
  verified.detections[0].common_uses = verified.detections[0].general_guidance.common_uses;
  const html = renderToStaticMarkup(React.createElement(Result, { result: verified }));
  assert.match(html, /General dosage information/);
  assert.match(html, /General adult example/);
  assert.match(html, /This is general dosage information/);

  const spoken = load('services/speechService.js', {
    'expo-speech': { stop: async () => {}, speak: () => {}, maxSpeechInputLength: 4000 },
    './languageService': { getLanguageOption: code => ({ code, speechCode: 'en-MY' }) },
  });
  const text = spoken.buildMedicineSpeech(verified, 'en');
  assert.match(text, /General adult dosage: General adult example/);
  assert.match(text, /For detailed dosage, read the instructions on the box/);
});
