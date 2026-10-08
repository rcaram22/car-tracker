import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import * as repo from '../../db/repository';
import { renderRoute } from '../../test/render';
import { BackupMenu } from './BackupMenu';

beforeEach(async () => {
  await repo.clearAll();
  await repo.createListing({ model: 'Golf', status: 'new' });
});

function upload(label: string, content: string, name: string) {
  const input = screen.getByLabelText(label) as HTMLInputElement;
  fireEvent.change(input, { target: { files: [new File([content], name)] } });
}

describe('BackupMenu', () => {
  it('shows a readable error and keeps data when the backup is invalid', async () => {
    renderRoute(<BackupMenu />);
    await userEvent.click(screen.getByRole('button', { name: 'Más opciones' }));
    upload('Archivo de backup', '{"hello":1}', 'x.json');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El archivo no es un backup de Car Tracker.',
    );
    expect((await repo.exportAll()).listings).toHaveLength(1);
  });

  it('imports the spreadsheet CSV and reports the count', async () => {
    renderRoute(<BackupMenu />);
    upload(
      'Archivo CSV',
      'Modelo,Color,Año,KMs,Precio,Link,Estado,Comentarios\nGolf Mk4 1.6,Azul,??,??,"$ 7,500.00",,,',
      'planilla.csv',
    );
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Importadas 1 publicaciones',
    );
    expect((await repo.exportAll()).listings).toHaveLength(2);
  });
});
