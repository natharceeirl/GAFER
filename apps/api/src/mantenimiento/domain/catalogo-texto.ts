export class CatalogoTexto {
  constructor(
    public readonly id: string,
    public readonly titulo: string,
    private _items: string[],
    public readonly soloAdministrador: boolean = false,
  ) {}

  get items(): string[] {
    return [...this._items];
  }

  actualizarItems(items: string[]): void {
    const limpios = items.map((i) => i.trim()).filter((i) => i.length > 0);
    this._items = [...limpios];
  }

  agregarItem(item: string): void {
    const limpio = item.trim();
    if (!limpio) {
      throw new Error('El item de texto no puede estar vacío');
    }
    if (!this._items.includes(limpio)) {
      this._items.push(limpio);
    }
  }

  quitarItem(item: string): void {
    const limpio = item.trim();
    this._items = this._items.filter((i) => i !== limpio);
  }
}
