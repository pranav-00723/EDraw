/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ComputedLine } from '../../types/lines';
import { RotatingLineConstructionEngine } from './RotatingLineConstructionEngine';

interface PictorialDraftingStagesProps {
  line: ComputedLine;
  hpColor?: string;
  vpColor?: string;
  isDark?: boolean;
}

export const PictorialDraftingStages: React.FC<PictorialDraftingStagesProps> = ({
  line,
  hpColor = '#2563eb',
  vpColor = '#dc2626',
  isDark = true,
}) => {
  return (
    <RotatingLineConstructionEngine
      line={line}
      hpColor={hpColor}
      vpColor={vpColor}
      isDark={isDark}
    />
  );
};
