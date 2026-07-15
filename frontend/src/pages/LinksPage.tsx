import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { linksApi } from "../api/client";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import { Input, Select, Textarea } from "../components/ui/Input";
import { Plus, Link2, Star, ExternalLink, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

const CATEGORIES = ["documentation","tool","reference","exploit","cve","wordlist","cheatsheet","blog","osint","other"].map(v => ({ value: v, label: v.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) }));

export default function LinksPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState({ category: "", q: "", favorites: false });
  const [form, setForm] = useState({ title: "", url: "", category: "reference", description: "", tags: "" });

  const { data: links = [] } = useQuery({ queryKey: ["links", filter], queryFn: () => linksApi.list({ ...(filter.category && { category: filter.category }), ...(filter.q && { q: filter.q }), ...(filter.favorites && { is_favorite: "true" }) }) });

  const createMut = useMutation({ mutationFn: (data: typeof form) => linksApi.create(data), onSuccess: () => { qc.invalidateQueries({ queryKey: ["links"] }); setShowModal(false); toast.success("Link saved"); } });
  const deleteMut = useMutation({ mutationFn: (id: string) => linksApi.remove(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["links"] }) });
  const favMut = useMutation({ mutationFn: ({ id, fav }: { id: string; fav: boolean }) => linksApi.update(id, { is_favorite: fav }), onSuccess: () => qc.invalidateQueries({ queryKey: ["links"] }) });
  const openMut = useMutation({ mutationFn: (id: string) => linksApi.open(id) });

  type Link = { id: string; title: string; url: string; category: string; description?: string; is_favorite: boolean; open_count: number };
  const allLinks = links as Link[];
  const catOpts = [{ value: "", label: "All" }, ...CATEGORIES];

  const openLink = (l: Link) => { window.open(l.url, "_blank", "noopener,noreferrer"); openMut.mutate(l.id); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-white">Links</h1>
        <div className="flex gap-2">
          <Input placeholder="Search…" value={filter.q} onChange={e => setFilter(f => ({ ...f, q: e.target.value }))} className="w-40" />
          <Select options={catOpts} value={filter.category} onChange={e => setFilter(f => ({ ...f, category: e.target.value }))} />
          <button onClick={() => setFilter(f => ({ ...f, favorites: !f.favorites }))} className={`px-3 py-1.5 rounded text-xs border ${filter.favorites ? "bg-yellow-500/20 border-yellow-500 text-yellow-300" : "border-gray-700 text-gray-400"}`}><Star size={12} className="inline mr-1"/>Favs</button>
          <Button variant="primary" size="sm" onClick={() => setShowModal(true)}><Plus size={14}/> Add</Button>
        </div>
      </div>
      <div className="grid gap-2">
        {allLinks.map(l => (
          <div key={l.id} className="bg-gray-900 border border-gray-800 rounded-lg p-3 flex items-start gap-3">
            <Link2 size={14} className="text-brand-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-white text-sm">{l.title}</span>
                <span className="text-xs bg-gray-800 text-gray-400 px-1.5 rounded">{l.category}</span>
                {l.open_count > 0 && <span className="text-xs text-gray-600">{l.open_count}x</span>}
              </div>
              <div className="text-xs text-brand-400/70 truncate mt-0.5">{l.url}</div>
              {l.description && <div className="text-xs text-gray-500 mt-0.5">{l.description}</div>}
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <button onClick={() => favMut.mutate({ id: l.id, fav: !l.is_favorite })} className={`p-1 ${l.is_favorite ? "text-yellow-400" : "text-gray-600 hover:text-yellow-400"}`}><Star size={12}/></button>
              <button onClick={() => openLink(l)} className="p-1 text-gray-400 hover:text-brand-400"><ExternalLink size={12}/></button>
              <button onClick={() => deleteMut.mutate(l.id)} className="p-1 text-gray-500 hover:text-red-400"><Trash2 size={12}/></button>
            </div>
          </div>
        ))}
        {allLinks.length === 0 && <div className="text-center py-8 text-gray-500">No links yet.</div>}
      </div>
      {showModal && (
        <Modal title="Add Link" onClose={() => setShowModal(false)}>
          <div className="space-y-3">
            <Input label="Title *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            <Input label="URL *" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} type="url" placeholder="https://" />
            <Select label="Category" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} options={CATEGORIES} />
            <Textarea label="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={() => createMut.mutate(form)} disabled={!form.title || !form.url}>Save</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
