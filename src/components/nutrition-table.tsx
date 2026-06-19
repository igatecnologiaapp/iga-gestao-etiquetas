import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type NutritionRow = {
  serving_size_g?: number | null;
  serving_household?: string | null;
  servings_per_pack?: number | null;
  energy_kcal?: number | null;
  carbs_g?: number | null;
  total_sugars_g?: number | null;
  added_sugars_g?: number | null;
  protein_g?: number | null;
  total_fat_g?: number | null;
  saturated_fat_g?: number | null;
  trans_fat_g?: number | null;
  fiber_g?: number | null;
  sodium_mg?: number | null;
};

const fmt = (v: number | null | undefined, suffix = "") =>
  v === null || v === undefined ? "—" : `${Number(v)}${suffix}`;

export function NutritionTable({ data }: { data: NutritionRow }) {
  return (
    <div className="space-y-2">
      <div className="text-sm text-muted-foreground">
        Porção: <strong>{fmt(data.serving_size_g, " g")}</strong>
        {data.serving_household && <> ({data.serving_household})</>}
        {data.servings_per_pack != null && <> · Porções/embalagem: {data.servings_per_pack}</>}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nutriente</TableHead>
            <TableHead className="text-right">Quantidade por porção</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow><TableCell>Valor energético</TableCell><TableCell className="text-right">{fmt(data.energy_kcal, " kcal")}</TableCell></TableRow>
          <TableRow><TableCell>Carboidratos</TableCell><TableCell className="text-right">{fmt(data.carbs_g, " g")}</TableCell></TableRow>
          <TableRow><TableCell className="pl-6">Açúcares totais</TableCell><TableCell className="text-right">{fmt(data.total_sugars_g, " g")}</TableCell></TableRow>
          <TableRow><TableCell className="pl-6">Açúcares adicionados</TableCell><TableCell className="text-right">{fmt(data.added_sugars_g, " g")}</TableCell></TableRow>
          <TableRow><TableCell>Proteínas</TableCell><TableCell className="text-right">{fmt(data.protein_g, " g")}</TableCell></TableRow>
          <TableRow><TableCell>Gorduras totais</TableCell><TableCell className="text-right">{fmt(data.total_fat_g, " g")}</TableCell></TableRow>
          <TableRow><TableCell className="pl-6">Saturadas</TableCell><TableCell className="text-right">{fmt(data.saturated_fat_g, " g")}</TableCell></TableRow>
          <TableRow><TableCell className="pl-6">Trans</TableCell><TableCell className="text-right">{fmt(data.trans_fat_g, " g")}</TableCell></TableRow>
          <TableRow><TableCell>Fibra alimentar</TableCell><TableCell className="text-right">{fmt(data.fiber_g, " g")}</TableCell></TableRow>
          <TableRow><TableCell>Sódio</TableCell><TableCell className="text-right">{fmt(data.sodium_mg, " mg")}</TableCell></TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
