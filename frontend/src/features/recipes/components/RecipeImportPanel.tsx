import type { ReactElement } from "react";

import { Button, Card, FormField, TextInput } from "../../../ui";

type RecipeImportPanelProps = {
  backupJson: string;
  importUrl: string;
  onExportBackup: () => Promise<void>;
  onImportBackup: () => Promise<void>;
  onImportUrl: () => Promise<void>;
  setBackupJson: (value: string) => void;
  setImportUrl: (value: string) => void;
  showBackupTools: boolean;
};

export function RecipeImportPanel({
  backupJson,
  importUrl,
  onExportBackup,
  onImportBackup,
  onImportUrl,
  setBackupJson,
  setImportUrl,
  showBackupTools,
}: RecipeImportPanelProps): ReactElement {
  return (
    <Card as="section" className="recipe-page-card recipe-tool-card">
      <div className="recipe-section-heading">
        <div>
          <p className="eyebrow">Quick Add</p>
          <h2>Add recipes quickly</h2>
          <p>
            Paste a recipe URL to import title, servings, ingredients, source
            attribution, and steps.
          </p>
        </div>
      </div>
      <div className="recipe-import-row">
        <FormField label="Import Recipe URL" className="recipe-form-field">
          <TextInput
            type="url"
            value={importUrl}
            onChange={(event) => setImportUrl(event.target.value)}
            placeholder="https://example.com/recipe"
          />
        </FormField>
        <Button type="button" onClick={() => void onImportUrl()}>
          Import from URL
        </Button>
      </div>
      {showBackupTools ? (
        <div className="recipe-backup-panel">
          <div className="recipe-section-heading recipe-section-heading--compact">
            <div>
              <h3>Backup & Restore</h3>
              <p>
                Export a portable JSON backup or paste one here to restore
                recipes.
              </p>
            </div>
            <Button type="button" onClick={() => void onExportBackup()}>
              Export Backup
            </Button>
          </div>
          <FormField
            label="Import Backup JSON"
            className="recipe-form-field"
          >
            <textarea
              value={backupJson}
              onChange={(event) => setBackupJson(event.target.value)}
              placeholder="Paste a Family Manager recipe backup JSON here."
            />
          </FormField>
          <Button type="button" onClick={() => void onImportBackup()}>
            Import Backup
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
