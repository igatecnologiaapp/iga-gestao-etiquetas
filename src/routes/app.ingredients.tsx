import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { SimpleCrud } from "@/components/simple-crud";

export const Route = createFileRoute("/app/ingredients")({
  head: () => ({ meta: [{ title: "Ingredientes — Etiquetas" }] }),
  component: () => (
    <>
      <PageHeader title="Ingredientes" description="Cadastro de ingredientes utilizados nos produtos." />
      <SimpleCrud table="ingredients" title="ingrediente" fields={[
        { name: "name", label: "Nome", required: true },
        { name: "description", label: "Descrição" },
        { name: "origin", label: "Origem" },
      ]} />
    </>
  ),
});
