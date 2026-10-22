import { createClient } from '@/lib/supabase';
import { MappingRepository } from './repository';

let repository: MappingRepository | null = null;
export function mappingRepository() {
  const client = createClient();
  if (!client) throw new Error('Chưa kết nối Supabase.');
  repository ??= new MappingRepository(client);
  return repository;
}
