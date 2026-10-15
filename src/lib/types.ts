// Tipos compartidos. La forma de Rec/Filter/SearchReq/Page replica la API v3 de Nexa
// (properties, filterGroups, sorts, results/paging) para que luego baste con cambiar el origen de datos.
export type ObjKey = 'contacts' | 'companies' | 'deals' | 'appointments' | 'tasks' | 'calls' | 'notes' | 'meetings' | 'tickets' | 'leads' | 'communications' | 'products' | 'line_items' | 'quotes' | 'invoices';

export type Rec = {
  id: string;
  properties: Record<string, string | null>;
  createdAt: string;
  updatedAt: string;
  archived?: boolean;
};

export type Op = 'EQ' | 'NEQ' | 'IN' | 'NOT_IN' | 'GT' | 'GTE' | 'LT' | 'LTE' | 'BETWEEN' | 'HAS_PROPERTY' | 'NOT_HAS_PROPERTY' | 'CONTAINS_TOKEN' | 'NOT_CONTAINS_TOKEN';
export type Filter = { propertyName: string; operator: Op; value?: string; highValue?: string; values?: string[] };
export type FilterGroup = { filters: Filter[] };
export type Sort = { propertyName: string; direction: 'ASCENDING' | 'DESCENDING' };
export type SearchReq = { query?: string; filterGroups?: FilterGroup[]; sorts?: Sort[]; limit?: number; after?: number };
export type Page<T> = { total: number; results: T[]; paging?: { next?: { after: number } } };

export type AssocRow = { from: ObjKey; fromId: string; to: ObjKey; toId: string; label?: string };

export type KpiDef = { label: string; filterGroups: FilterGroup[] };
export type ViewDef = {
  id: string; objectType: ObjKey; name: string;
  filterGroups: FilterGroup[]; columns: string[]; sorts: Sort[];
  owner: string; shared: 'PRIVATE' | 'PUBLIC';
  quickFilters?: string[]; kpis?: KpiDef[]; mode?: 'table' | 'board'; builtin?: boolean;
};

export type Owner = { id: string; firstName: string; lastName: string; email: string; teams: string[] };

export type AppDef = {
  id: string; name: string; description: string; createdAt: string;
  token: string; tokenMasked: string; clientSecretMasked: string; clientSecret: string;
  scopes: string[]; targetUrl: string; throttle: number;
  expiresAt?: string | null; allowedCidrs?: string[]; maxRowsPerDay?: number; createdBy?: string | null; extendDays?: number;
  subs: { id: string; objectType: ObjKey; event: 'creation' | 'propertyChange' | 'deletion' | 'associationChange'; property?: string; anyProperty?: boolean; valueEquals?: string; active: boolean; total: number; errors: number }[];
};
export type ApiLogRow = { id: string; at: string; method: string; url: string; status: number; appId: string };
export type AuditRow = { id: string; at: string; category: string; subcategory: string; action: string; by: string; source: string };
