import React from "react";
import { motion } from "motion/react";
import { Bell, Plus } from "lucide-react";

interface FloatingActionButtonsProps {
  onOpenShelfLifeAlert?: () => void;
}

export const FloatingActionButtons: React.FC<FloatingActionButtonsProps> = ({ onOpenShelfLifeAlert }) => {
  return (
    <div className="fixed bottom-8 right-8 flex flex-col gap-4">
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        className="w-14 h-14 bg-white shadow-xl rounded-full flex items-center justify-center text-primary border border-primary/10 group"
      >
        <Plus size={24} className="group-hover:rotate-90 transition-transform" />
      </motion.button>
      {onOpenShelfLifeAlert ? (
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={onOpenShelfLifeAlert}
          className="w-14 h-14 bg-primary text-white shadow-xl rounded-full flex items-center justify-center group"
          aria-label="效期预警"
          title="效期预警"
        >
          <Bell
            size={24}
            className="group-hover:scale-110 transition-transform"
          />
        </motion.button>
      ) : null}
    </div>
  );
};
