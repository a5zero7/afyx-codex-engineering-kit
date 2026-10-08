/** Afyx-native production extraction dispatch. */

import * as path from 'path';
import type { ExtractionResult, Language } from '../types';
import { detectLanguage, isFileLevelOnlyLanguage } from './grammars';
import { LiquidExtractor } from './liquid-extractor';
import { RazorExtractor } from './razor-extractor';
import { SvelteExtractor } from './svelte-extractor';
import { AstroExtractor } from './astro-extractor';
import { DfmExtractor } from './dfm-extractor';
import { VueExtractor } from './vue-extractor';
import { MyBatisExtractor } from './mybatis-extractor';
import { extractNativeFacts } from './native/fact-extractor';
import { extractNativeCfmlFacts } from './native/cfml-facts';
import { getAllFrameworkResolvers, getApplicableFrameworks } from '../resolution/frameworks';

const NATIVE_FACT_LANGUAGES: ReadonlySet<Language> = new Set([
  'typescript', 'tsx', 'javascript', 'jsx', 'arkts', 'python', 'go', 'java',
  'rust', 'kotlin', 'scala', 'c', 'cpp', 'objc', 'csharp', 'swift', 'solidity',
  'php', 'ruby', 'lua', 'luau', 'r', 'dart', 'nix', 'pascal', 'vbnet', 'erlang',
  'terraform', 'cobol',
]);

export function extractFromSource(
  filePath: string,
  source: string,
  language?: Language,
  frameworkNames?: string[],
): ExtractionResult {
  const detectedLanguage = language || detectLanguage(filePath, source);
  const fileExtension = path.extname(filePath).toLowerCase();
  let result: ExtractionResult;

  if (detectedLanguage === 'cfml' || detectedLanguage === 'cfscript' || detectedLanguage === 'cfquery') {
    result = extractNativeCfmlFacts(filePath, source, detectedLanguage);
  } else if (
    NATIVE_FACT_LANGUAGES.has(detectedLanguage) &&
    !(detectedLanguage === 'pascal' && (fileExtension === '.dfm' || fileExtension === '.fmx'))
  ) {
    result = extractNativeFacts(filePath, source, detectedLanguage);
  } else if (detectedLanguage === 'svelte') {
    result = new SvelteExtractor(filePath, source).extract();
  } else if (detectedLanguage === 'vue') {
    result = new VueExtractor(filePath, source).extract();
  } else if (detectedLanguage === 'astro') {
    result = new AstroExtractor(filePath, source).extract();
  } else if (detectedLanguage === 'liquid') {
    result = new LiquidExtractor(filePath, source).extract();
  } else if (detectedLanguage === 'razor') {
    result = new RazorExtractor(filePath, source).extract();
  } else if (detectedLanguage === 'xml') {
    result = new MyBatisExtractor(filePath, source).extract();
  } else if (isFileLevelOnlyLanguage(detectedLanguage)) {
    result = { nodes: [], edges: [], unresolvedReferences: [], errors: [], durationMs: 0 };
  } else if (
    detectedLanguage === 'pascal' &&
    (fileExtension === '.dfm' || fileExtension === '.fmx')
  ) {
    result = new DfmExtractor(filePath, source).extract();
  } else {
    result = {
      nodes: [], edges: [], unresolvedReferences: [],
      errors: [{
        message: `Unsupported language: ${detectedLanguage}`,
        filePath,
        severity: 'error',
        code: 'unsupported_language',
      }],
      durationMs: 0,
    };
  }

  if (frameworkNames && frameworkNames.length > 0) {
    const applicable = getApplicableFrameworks(
      getAllFrameworkResolvers().filter((resolver) => frameworkNames.includes(resolver.name)),
      detectedLanguage,
    );
    for (const framework of applicable) {
      if (!framework.extract) continue;
      try {
        const frameworkResult = framework.extract(filePath, source);
        result.nodes.push(...frameworkResult.nodes);
        result.unresolvedReferences.push(...frameworkResult.references);
      } catch (error) {
        result.errors.push({
          message: `Framework extractor '${framework.name}' failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
          filePath,
          severity: 'warning',
        });
      }
    }
  }

  return result;
}
