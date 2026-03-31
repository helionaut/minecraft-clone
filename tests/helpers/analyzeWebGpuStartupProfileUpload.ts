// @ts-expect-error JS helper without generated TypeScript declarations.
import * as analyzeStartupProfileUploadScript from '../../scripts/analyzeWebGpuStartupProfileUpload.mjs';

export type StartupProfileUploadAnalysisPlan =
  | {
    ok: false;
    error: string;
  }
  | {
    ok: true;
    sourcePath: string;
    outputDir: string;
    baselineReportPath: string;
    baselineArtifactDir: string;
    baselineLabel: string;
    candidateLabel: string;
  };

export type ResolvedStartupProfileUploadSource = {
  analysisRootDir: string;
  artifactDir: string;
  importedFromZip: boolean;
};

export type StartupProfileUploadAnalysisResult = ResolvedStartupProfileUploadSource & {
  reportJsonPath: string;
  reportMarkdownPath: string;
  comparisonJsonPath: string;
  comparisonMarkdownPath: string;
  manifestJsonPath: string;
  manifestMarkdownPath: string;
  targetSurface: Record<string, unknown> | null;
};

export const buildStartupProfileUploadAnalysisPlan =
  analyzeStartupProfileUploadScript.buildStartupProfileUploadAnalysisPlan as (
    env?: Record<string, string | undefined>,
  ) => StartupProfileUploadAnalysisPlan;

export const defaultImportedUploadDir =
  analyzeStartupProfileUploadScript.defaultImportedUploadDir as (
    sourcePath: string,
  ) => string;

export const findStartupProfileArtifactDir =
  analyzeStartupProfileUploadScript.findStartupProfileArtifactDir as (
    rootDir: string,
  ) => Promise<string | null>;

export const resolveStartupProfileUploadSource =
  analyzeStartupProfileUploadScript.resolveStartupProfileUploadSource as (
    plan: { sourcePath: string; outputDir?: string },
    extractArchive?: (sourcePath: string, outputDir: string) => Promise<string>,
  ) => Promise<ResolvedStartupProfileUploadSource>;

export const analyzeStartupProfileUpload =
  analyzeStartupProfileUploadScript.analyzeStartupProfileUpload as (
    plan: {
      sourcePath: string;
      outputDir?: string;
      baselineReportPath: string;
      baselineArtifactDir: string;
      baselineLabel: string;
      candidateLabel: string;
    },
    extractArchive?: (sourcePath: string, outputDir: string) => Promise<string>,
  ) => Promise<StartupProfileUploadAnalysisResult>;
