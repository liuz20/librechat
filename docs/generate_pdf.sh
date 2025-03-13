#!/bin/bash

# Script to generate a PDF from markdown files in chapter directories

# Font configuration for Chinese character support
# Modify these variables according to your needs and available fonts
MAIN_FONT="PingFang SC"  # A font with good Chinese support
CJK_FONT="PingFang SC"   # Font specifically for Chinese characters
FALLBACK_FONT="Menlo"     # Fallback font if the above aren't available
FONT_SIZE="11pt"                # Base font size
PAPER_SIZE="a4"                 # Paper size

set -e  # Exit on error

# Display error message and exit
error_exit() {
    echo "Error: $1" >&2
    exit 1
}

# Check if pandoc is installed
if ! command -v pandoc &> /dev/null; then
    error_exit "pandoc is not installed. Please install it first."
fi

# Create build directory
echo "Creating build directory..."
mkdir -p build || error_exit "Failed to create build directory"

# Find all markdown files in chapter directories in numeric order
echo "Finding markdown files in chapter directories..."
FILES=$(find chap*_* -type f -name "*.md" | sort -V)

if [ -z "$FILES" ]; then
    error_exit "No markdown files found in chapter directories"
fi

# Display found files
echo "Found the following markdown files:"
for file in $FILES; do
    echo "  - $file"
done

# Generate PDF using pandoc
echo "Generating PDF..."
pandoc $FILES \
    --pdf-engine=xelatex \
    -V documentclass=article \
    -V classoption=UTF8 \
    -V mainfont="$MAIN_FONT" \
    -V CJKmainfont="$CJK_FONT" \
    -V sansfont="$FALLBACK_FONT" \
    -V monofont="$FALLBACK_FONT" \
    -V fontsize="$FONT_SIZE" \
    -V papersize="$PAPER_SIZE" \
    -V geometry:margin=1in \
    -V lang=zh-CN \
    -V colorlinks=true \
    -V linkcolor=blue \
    -V urlcolor=blue \
    --standalone \
    --toc \
    -o build/documentation.pdf \
    || error_exit "Failed to generate PDF with pandoc"

# Make the file readable
chmod 644 build/documentation.pdf || error_exit "Failed to set permissions on PDF file"

echo "Success! PDF generated at build/documentation.pdf"
echo "Note: If Chinese characters don't display correctly, verify that the fonts specified at the top of this script are installed on your system."

