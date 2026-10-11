import type { Source } from '../shared/types';
import { keikkalista } from './keikkalista';
import { keskisuomievents } from './keskisuomievents';
import { paviljonki } from './paviljonki';
import { peurunka } from './peurunka';

export const SOURCES: Source[] = [paviljonki, peurunka, keikkalista, keskisuomievents];
