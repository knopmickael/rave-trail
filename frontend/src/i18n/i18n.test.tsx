// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { abilities } from '@game/content/abilities';
import { units, narrativeCharacters } from '@game/content/units';
import { campaigns } from '@game/content/campaigns';
import { encounters } from '@game/content/encounters';
import { battleUnlockRules } from '@game/content/unlocks';
import { FINAL_BATTLE_REQUIREMENT, OSIRIS_BATTLE_REQUIREMENT } from '@game/content/campaign-rules';
import { SECOND_CAMPAIGN_INTRODUCTION } from '@game/content/second-campaign';
import gameHistory from '../../../game-history.txt?raw';
import { content } from './content';
import { messages } from './messages';
import { errorMessages } from './errors';
import { translate, translateText } from './translate';
import { detectLanguage, LanguageProvider, LANGUAGE_STORAGE_KEY, useI18n } from './LanguageProvider';
import { LanguageSelector } from './LanguageSelector';

beforeEach(() => {
  window.localStorage.clear();
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['pt-BR']);
});
afterEach(cleanup);

function Sample() {
  const { t, text, currency } = useI18n();
  return <><LanguageSelector details /><h1>{t('Configurações')}</h1><p>{text('E-mail ou senha incorretos.')}</p><output>{currency(9.9)}</output></>;
}

it.each([
  [['pt-PT', 'en-US'], 'pt-BR'], [['EN-gb', 'pt-BR'], 'en'],
  [['es-AR', 'pt'], 'pt-BR'], [['fr-FR', 'en-AU'], 'en'],
  [['de-DE'], 'en'], [[], 'en'], [[' pt_BR '], 'pt-BR'],
] as const)('resolve os idiomas preferidos %j para %s', (languages, expected) => {
  expect(detectLanguage(languages)).toBe(expected);
});

it('prioriza a preferência salva, troca imediatamente e restaura após remontar', async () => {
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-US']);
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'pt-BR');
  const user = userEvent.setup();
  const first = render(<LanguageProvider><Sample /></LanguageProvider>);
  expect(screen.getByRole('heading', { name: 'Configurações' })).toBeInTheDocument();
  await user.selectOptions(screen.getByLabelText('Idioma'), 'en');
  expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
  expect(screen.getByText('Incorrect email or password.')).toBeInTheDocument();
  expect(screen.getByText('$9.90')).toBeInTheDocument();
  expect(document.documentElement.lang).toBe('en');
  expect(document.title).toBe('Rave Trail | Online turn-based strategy RPG');
  expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');
  first.unmount();
  render(<LanguageProvider><Sample /></LanguageProvider>);
  expect(screen.getByLabelText('Language')).toHaveValue('en');
  await user.selectOptions(screen.getByLabelText('Language'), 'pt-BR');
  expect(document.documentElement.lang).toBe('pt-BR');
  expect(screen.getByText(/US\$\s*9,90/)).toBeInTheDocument();
});

it('segue alterações do navegador no modo automático e sincroniza a preferência entre abas', async () => {
  const languages = vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-GB']);
  const user = userEvent.setup();
  render(<LanguageProvider><Sample /></LanguageProvider>);
  expect(screen.getByLabelText('Language')).toHaveValue('auto');
  languages.mockReturnValue(['pt-PT']);
  fireEvent(window, new Event('languagechange'));
  expect(screen.getByRole('heading', { name: 'Configurações' })).toBeInTheDocument();
  await user.selectOptions(screen.getByLabelText('Idioma'), 'pt-BR');
  languages.mockReturnValue(['en-US']);
  fireEvent(window, new Event('languagechange'));
  expect(screen.getByRole('heading', { name: 'Configurações' })).toBeInTheDocument();
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: LANGUAGE_STORAGE_KEY, newValue: 'en', storageArea: window.localStorage })));
  expect(screen.getByLabelText('Language')).toHaveValue('en');
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: LANGUAGE_STORAGE_KEY, newValue: null, storageArea: window.localStorage })));
  expect(screen.getByLabelText('Language')).toHaveValue('auto');
  await user.selectOptions(screen.getByLabelText('Language'), 'pt-BR');
  await user.selectOptions(screen.getByLabelText('Idioma'), 'auto');
  expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
});

it('ignora valores inválidos e funciona com armazenamento bloqueado', async () => {
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'invalid');
  const first = render(<LanguageProvider><Sample /></LanguageProvider>);
  expect(screen.getByLabelText('Idioma')).toHaveValue('auto');
  first.unmount();
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  render(<LanguageProvider><Sample /></LanguageProvider>);
  await userEvent.setup().selectOptions(screen.getByLabelText('Idioma'), 'en');
  expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
});

it('mantém os parâmetros das traduções e insere nomes literalmente', () => {
  const placeholders = (value: string) => [...value.matchAll(/\{\w+\}/g)].map(([key]) => key).sort();
  for (const [source, english] of Object.entries(messages)) {
    expect(english.trim(), source).not.toBe('');
    expect(placeholders(english), source).toEqual(placeholders(source));
  }
  expect(translate('en', 'Abrir perfil de {name}', { name: '<Ravi> {name} $&' })).toBe('Open <Ravi> {name} $&’s profile');
  expect(translateText('en', 'Novo conteúdo ainda não traduzido')).toBe('Novo conteúdo ainda não traduzido');
  expect(translateText('en', 'toString')).toBe('toString');
});

it('cobre todo o catálogo atual, habilidades, campanhas, encontros, prólogos e desbloqueios', () => {
  const introduction = gameHistory.replace(/\r\n?/g, '\n').split('\nDesenvolvimento da narrativa')[0].trim().split(/\n+/).slice(1);
  const fixed = [
    ...Object.values(narrativeCharacters).map((character) => character.name),
    ...units.flatMap((unit) => [unit.name, unit.description, unit.version]),
    ...Object.values(abilities).flatMap((ability) => [ability.name, ability.description]),
    ...campaigns.flatMap((campaign) => [campaign.title, campaign.description]),
    ...encounters.flatMap((encounter) => [encounter.title, encounter.story]),
    ...introduction, ...SECOND_CAMPAIGN_INTRODUCTION, FINAL_BATTLE_REQUIREMENT, OSIRIS_BATTLE_REQUIREMENT,
  ];
  for (const source of fixed) {
    expect(Object.hasOwn(content, source), source).toBe(true);
    expect(translateText('pt-BR', source)).toBe(source);
  }
  const requirements = battleUnlockRules.flatMap((rule) => [rule.description, ...rule.requirements.map((requirement) => requirement.description)]);
  for (const source of [...requirements, ...units.map((unit) => unit.unlock.description), ...Object.keys(errorMessages)]) {
    const english = translateText('en', source);
    expect(english, source).not.toBe(source);
    expect(english, source).not.toMatch(/Finalize |Vença |Derrote |utilizando|Batalha rápida/);
  }
});

it('traduz mensagens variáveis sem perder nomes, valores ou condições das missões', () => {
  expect(translateText('en', 'Derrote Drak de Pontes na Batalha rápida 5 vezes utilizando Saqueadores da estrada.'))
    .toBe('Defeat Drak de Pontes in Quick battle 5 times using Road Raiders.');
  expect(translateText('en', 'Energia insuficiente para Golpe simples. Ajuste a ordem do combo.'))
    .toBe('Not enough energy for Simple Strike. Adjust the combo order.');
  expect(translateText('en', 'Capitão da guarda Kalis está impedido de atacar neste turno.'))
    .toBe('Guard Captain Kalis cannot attack this turn.');
  expect(translateText('en', 'Ravi de Berdal despertou como Ravi Berserk!')).toBe('Ravi de Berdal awakened as Ravi Berserk!');
  expect(translateText('en', 'Guarda aplicada em Curandeiro de Pontes: −10 por golpe, por 2 turnos.'))
    .toBe('Guard applied to Healer of Pontes: −10 per hit for 2 turns.');
});
