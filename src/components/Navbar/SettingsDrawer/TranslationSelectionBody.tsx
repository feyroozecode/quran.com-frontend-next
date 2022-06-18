import { useCallback, useState } from 'react';

import { Action } from '@reduxjs/toolkit';
import groupBy from 'lodash/groupBy';
import omit from 'lodash/omit';
import useTranslation from 'next-translate/useTranslation';
import { useRouter } from 'next/router';
import { useSelector } from 'react-redux';

import IconSearch from '../../../../public/icons/search.svg';

import styles from './SearchSelectionBody.module.scss';

import DataFetcher from 'src/components/DataFetcher';
import Checkbox from 'src/components/dls/Forms/Checkbox/Checkbox';
import Input from 'src/components/dls/Forms/Input';
import usePersistPreferenceGroup from 'src/hooks/usePersistPreferenceGroup';
import {
  selectTranslations,
  setSelectedTranslations,
} from 'src/redux/slices/QuranReader/translations';
import SliceName from 'src/redux/types/SliceName';
import { makeTranslationsUrl } from 'src/utils/apiPaths';
import {
  logValueChange,
  logItemSelectionChange,
  logEmptySearchResults,
} from 'src/utils/eventLogger';
import filterTranslations from 'src/utils/filter-translations';
import { getLocaleName } from 'src/utils/locale';
import { TranslationsResponse } from 'types/ApiResponses';
import PreferenceGroup from 'types/auth/PreferenceGroup';
import AvailableTranslation from 'types/AvailableTranslation';
import QueryParam from 'types/QueryParam';

const TranslationSelectionBody = () => {
  const { onSettingsChange } = usePersistPreferenceGroup();
  const { t, lang } = useTranslation('common');
  const router = useRouter();
  const translationsState = useSelector(selectTranslations);
  const { selectedTranslations } = translationsState;
  const [searchQuery, setSearchQuery] = useState('');

  /**
   * Persist settings in the DB if the user is logged in before dispatching
   * Redux action, otherwise just dispatch it.
   *
   * @param {number[]} value
   * @param {Action} action
   */
  const onTranslationsSettingsChange = useCallback(
    (value: number[], action: Action, undoAction: Action) => {
      onSettingsChange(
        'selectedTranslations',
        value,
        action,
        translationsState,
        undoAction,
        SliceName.TRANSLATIONS,
        PreferenceGroup.TRANSLATIONS,
      );
    },
    [onSettingsChange, translationsState],
  );

  const onTranslationsChange = useCallback(
    (selectedTranslationId: number) => {
      return (isChecked: boolean) => {
        // when the checkbox is checked
        // add the selectedTranslationId to redux
        // if unchecked, remove it from redux
        const nextTranslations = isChecked
          ? [...selectedTranslations, selectedTranslationId]
          : selectedTranslations.filter((id) => id !== selectedTranslationId); // remove the id

        logItemSelectionChange('translation', selectedTranslationId.toString(), isChecked);
        logValueChange('selected_translations', selectedTranslations, nextTranslations);
        onTranslationsSettingsChange(
          nextTranslations,
          setSelectedTranslations({ translations: nextTranslations, locale: lang }),
          setSelectedTranslations({ translations: selectedTranslations, locale: lang }),
        );
        if (nextTranslations.length) {
          router.query[QueryParam.Translations] = nextTranslations.join(',');
          router.push(router, undefined, { shallow: true });
        }
      };
    },
    [lang, onTranslationsSettingsChange, router, selectedTranslations],
  );

  const renderTranslationGroup = useCallback(
    (language, translations) => {
      if (!translations) {
        return <></>;
      }
      return (
        <div className={styles.group} key={language}>
          <div className={styles.language}>{language}</div>
          {translations
            .sort((a: AvailableTranslation, b: AvailableTranslation) =>
              a.authorName.localeCompare(b.authorName),
            )
            .map((translation: AvailableTranslation) => (
              <div key={translation.id} className={styles.item}>
                <Checkbox
                  id={translation.id.toString()}
                  checked={selectedTranslations.includes(translation.id)}
                  label={translation.translatedName.name}
                  onChange={onTranslationsChange(translation.id)}
                />
              </div>
            ))}
        </div>
      );
    },
    [onTranslationsChange, selectedTranslations],
  );

  return (
    <div>
      <div className={styles.searchInputContainer}>
        <Input
          prefix={<IconSearch />}
          id="translations-search"
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={t('settings.search-translations')}
          fixedWidth={false}
        />
      </div>
      <DataFetcher
        queryKey={makeTranslationsUrl(lang)}
        render={(data: TranslationsResponse) => {
          const filteredTranslations = searchQuery
            ? filterTranslations(data.translations, searchQuery)
            : data.translations;

          if (!filteredTranslations.length) {
            logEmptySearchResults(searchQuery, 'settings_drawer_translation');
          }

          const translationByLanguages = groupBy(filteredTranslations, 'languageName');
          const selectedTranslationLanguage = getLocaleName(lang).toLowerCase();
          const selectedTranslationGroup = translationByLanguages[selectedTranslationLanguage];
          const translationByLanguagesWithoutSelectedLanguage = omit(translationByLanguages, [
            selectedTranslationLanguage,
          ]);

          return (
            <div>
              {renderTranslationGroup(selectedTranslationLanguage, selectedTranslationGroup)}
              {Object.entries(translationByLanguagesWithoutSelectedLanguage)
                .sort((a, b) => {
                  return a[0].localeCompare(b[0]);
                })
                .map(([language, translations]) => {
                  return renderTranslationGroup(language, translations);
                })}
            </div>
          );
        }}
      />
    </div>
  );
};

export default TranslationSelectionBody;
