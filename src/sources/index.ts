import type { Source } from '../shared/types';
import { jelmu } from './jelmu';
import { jklteatteri } from './jklteatteri';
import { keikkalista } from './keikkalista';
import { keskisuomievents } from './keskisuomievents';
import { paviljonki } from './paviljonki';
import { peurunka } from './peurunka';

export const SOURCES: Source[] = [paviljonki, peurunka, jelmu, jklteatteri, keikkalista, keskisuomievents];
